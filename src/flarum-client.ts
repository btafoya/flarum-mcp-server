/**
 * Flarum API client
 * Wraps all HTTP interaction with the Flarum forum
 */

import { readFileSync, writeFileSync, existsSync, constants } from "fs";
import { join } from "path";
import { homedir } from "os";
import type {
  LoginResult,
  Discussion,
  Post,
  Tag,
  User,
  ListParams,
  CreateDiscussionParams,
  UpdateDiscussionParams,
  CreatePostParams,
  UpdatePostParams,
  JsonApiResponse,
  JsonApiErrorResponse,
  DiscussionAttributes,
  PostAttributes,
  UserAttributes,
  TagAttributes,
} from "./types.js";

// Token cache file interface
interface TokenCache {
  token: string;
  userId: string;
  baseUrl: string;
  createdAt: number;
  expiresAt: number; // Expires in 5 years (when remember=true)
}

export class FlarumClient {
  private baseUrl: string;
  private token: string | null = null;
  private userId: string | null = null;
  private cacheFilePath: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.FLARUM_BASE_URL || "http://localhost";
    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, "");

    // Cache file path: ~/.flarum-mcp-token.json under the user directory
    this.cacheFilePath = join(homedir(), ".flarum-mcp-token.json");
  }

  /**
   * Load cached token from file
   */
  loadCachedToken(): boolean {
    try {
      if (!existsSync(this.cacheFilePath)) {
        return false;
      }

      const data = readFileSync(this.cacheFilePath, "utf-8");
      const cache: TokenCache = JSON.parse(data);

      // Verify it is the same forum
      if (cache.baseUrl !== this.baseUrl) {
        console.error("Cached token is from a different forum, ignoring");
        return false;
      }

      // Verify expiration
      if (Date.now() > cache.expiresAt) {
        console.error("Cached token has expired");
        return false;
      }

      this.token = cache.token;
      this.userId = cache.userId;
      return true;
    } catch (error) {
      console.error("Failed to load token cache:", error);
      return false;
    }
  }

  /**
   * Save token to file
   */
  private saveCachedToken(): void {
    if (!this.token || !this.userId) {
      return;
    }

    try {
      const cache: TokenCache = {
        token: this.token,
        userId: this.userId,
        baseUrl: this.baseUrl,
        createdAt: Date.now(),
        // 5-year validity (login with remember=true)
        expiresAt: Date.now() + 5 * 365 * 24 * 60 * 60 * 1000,
      };

      writeFileSync(this.cacheFilePath, JSON.stringify(cache, null, 2), {
        encoding: "utf-8",
        mode: constants.S_IRUSR | constants.S_IWUSR, // ponytail: 0o600, readable only by owner
      });
      console.error(`Token cached to: ${this.cacheFilePath}`);
    } catch (error) {
      console.error("Failed to save token cache:", error);
    }
  }

  /**
   * Clear cached token
   */
  clearCachedToken(): void {
    try {
      if (existsSync(this.cacheFilePath)) {
        writeFileSync(this.cacheFilePath, "{}", "utf-8");
      }
    } catch (error) {
      console.error("Failed to clear token cache:", error);
    }
  }

  /**
   * Validate whether the current token is valid
   */
  async validateToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      // Try accessing an authenticated API to validate the token
      await this.request<JsonApiResponse>("GET", "/api/users/me");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set authentication token
   */
  setToken(token: string, userId?: string): void {
    this.token = token;
    if (userId) {
      this.userId = userId;
    }
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Check whether logged in
   */
  isAuthenticated(): boolean {
    return this.token !== null;
  }

  /**
   * Build request headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Token ${this.token}`;
    }

    return headers;
  }

  /**
   * Send HTTP request
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // ponytail: 30s default, make configurable if hosts vary wildly

    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      signal: controller.signal,
    };

    if (body && (method === "POST" || method === "PATCH")) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // Handle 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as JsonApiErrorResponse;
        const errorMessage = errorData.errors
          ?.map((e) => e.detail || e.code)
          .join(", ") || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==================== Authentication API ====================

  /**
   * Login to get token
   */
  async login(
    identification: string,
    password: string,
    remember?: boolean
  ): Promise<LoginResult> {
    const endpoint = remember ? "/api/token?remember=1" : "/api/token";

    const result = await this.request<LoginResult>("POST", endpoint, {
      identification,
      password,
    });

    // Save token to memory
    this.token = result.token;
    this.userId = result.userId;

    // Save token to file cache
    this.saveCachedToken();

    return result;
  }

  /**
   * Logout
   */
  logout(): void {
    this.token = null;
    this.userId = null;
    // Clear cache file
    this.clearCachedToken();
  }

  // ==================== Discussion API ====================

  /**
   * Get discussion list
   */
  async getDiscussions(params?: ListParams): Promise<Discussion[]> {
    const queryParts: string[] = [];

    if (params?.limit) {
      queryParts.push(`page[limit]=${params.limit}`);
    }
    if (params?.offset) {
      queryParts.push(`page[offset]=${params.offset}`);
    }
    if (params?.sort) {
      queryParts.push(`sort=${params.sort}`);
    }

    // Build search query (use Flarum Gambit syntax to unify all filters)
    const searchParts: string[] = [];

    // Keyword search
    if (params?.search) {
      searchParts.push(params.search);
    }

    // Filter by user (Gambit syntax author:username)
    if (params?.username) {
      searchParts.push(`author:${params.username}`);
    } else if (params?.userId) {
      searchParts.push(`author:${params.userId}`);
    }

    // Filter by tag (Gambit syntax tag:slug)
    if (params?.tag) {
      searchParts.push(`tag:${params.tag}`);
    }

    // Date filter (Gambit syntax created:)
    if (params?.createdAfter && params?.createdBefore) {
      // Date range: created:YYYY-MM-DD..YYYY-MM-DD
      searchParts.push(`created:${params.createdAfter}..${params.createdBefore}`);
    } else if (params?.createdAfter) {
      // After date: created:>YYYY-MM-DD
      searchParts.push(`created:>${params.createdAfter}`);
    } else if (params?.createdBefore) {
      // Before date: created:<YYYY-MM-DD
      searchParts.push(`created:<${params.createdBefore}`);
    }

    // Combine all filters into the filter[q] parameter
    if (searchParts.length > 0) {
      queryParts.push(`filter[q]=${encodeURIComponent(searchParts.join(" "))}`);
    }

    // Include user and tag information
    queryParts.push("include=user,tags,firstPost");

    const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    const response = await this.request<JsonApiResponse<DiscussionAttributes>>(
      "GET",
      `/api/discussions${query}`
    );

    return this.parseDiscussions(response);
  }

  /**
   * Get a single discussion
   */
  async getDiscussion(id: string): Promise<Discussion> {
    const response = await this.request<JsonApiResponse<DiscussionAttributes>>(
      "GET",
      `/api/discussions/${id}?include=user,tags,firstPost`
    );

    const discussions = this.parseDiscussions(response);
    if (discussions.length === 0) {
      throw new Error(`Discussion ${id} not found`);
    }
    return discussions[0];
  }

  /**
   * Create discussion
   */
  async createDiscussion(params: CreateDiscussionParams): Promise<Discussion> {
    const body: Record<string, unknown> = {
      data: {
        type: "discussions",
        attributes: {
          title: params.title,
          content: params.content,
        },
        relationships: {},
      },
    };

    // Add tags
    if (params.tagIds && params.tagIds.length > 0) {
      (body.data as Record<string, unknown>).relationships = {
        tags: {
          data: params.tagIds.map((id) => ({ type: "tags", id })),
        },
      };
    }

    const response = await this.request<JsonApiResponse<DiscussionAttributes>>(
      "POST",
      "/api/discussions",
      body
    );

    const discussions = this.parseDiscussions(response);
    return discussions[0];
  }

  /**
   * Update discussion
   */
  async updateDiscussion(
    id: string,
    params: UpdateDiscussionParams
  ): Promise<Discussion> {
    const attributes: Record<string, unknown> = {};

    if (params.title !== undefined) {
      attributes.title = params.title;
    }
    if (params.isSticky !== undefined) {
      attributes.isSticky = params.isSticky;
    }
    if (params.isLocked !== undefined) {
      attributes.isLocked = params.isLocked;
    }

    const body = {
      data: {
        type: "discussions",
        id,
        attributes,
      },
    };

    const response = await this.request<JsonApiResponse<DiscussionAttributes>>(
      "PATCH",
      `/api/discussions/${id}`,
      body
    );

    const discussions = this.parseDiscussions(response);
    return discussions[0];
  }

  /**
   * Delete discussion
   * @param id Discussion ID
   * @param permanent Whether to permanently delete (default false = soft delete/hide)
   */
  async deleteDiscussion(id: string, permanent: boolean = false): Promise<void> {
    if (permanent) {
      // Permanent deletion (requires admin rights)
      await this.request<void>("DELETE", `/api/discussions/${id}`);
    } else {
      // Soft delete/hide (regular users can do this to their own discussions)
      await this.request<JsonApiResponse<DiscussionAttributes>>("PATCH", `/api/discussions/${id}`, {
        data: {
          type: "discussions",
          id,
          attributes: {
            isHidden: true,
          },
        },
      });
    }
  }

  // ==================== Post API ====================

  /**
   * Get post list for a discussion
   */
  async getPosts(discussionId: string, params?: ListParams): Promise<Post[]> {
    const queryParts: string[] = [`filter[discussion]=${discussionId}`];

    if (params?.limit) {
      queryParts.push(`page[limit]=${params.limit}`);
    }
    if (params?.offset) {
      queryParts.push(`page[offset]=${params.offset}`);
    }

    queryParts.push("include=user");

    const query = `?${queryParts.join("&")}`;
    const response = await this.request<JsonApiResponse<PostAttributes>>(
      "GET",
      `/api/posts${query}`
    );

    return this.parsePosts(response, discussionId);
  }

  /**
   * Get a single post
   */
  async getPost(id: string): Promise<Post> {
    const response = await this.request<JsonApiResponse<PostAttributes>>(
      "GET",
      `/api/posts/${id}?include=user,discussion`
    );

    const posts = this.parsePosts(response);
    if (posts.length === 0) {
      throw new Error(`Post ${id} not found`);
    }
    return posts[0];
  }

  /**
   * Create post (reply)
   */
  async createPost(params: CreatePostParams): Promise<Post> {
    const body = {
      data: {
        type: "posts",
        attributes: {
          content: params.content,
        },
        relationships: {
          discussion: {
            data: {
              type: "discussions",
              id: params.discussionId,
            },
          },
        },
      },
    };

    const response = await this.request<JsonApiResponse<PostAttributes>>(
      "POST",
      "/api/posts",
      body
    );

    const posts = this.parsePosts(response, params.discussionId);
    return posts[0];
  }

  /**
   * Update post
   */
  async updatePost(id: string, params: UpdatePostParams): Promise<Post> {
    const body = {
      data: {
        type: "posts",
        id,
        attributes: {
          content: params.content,
        },
      },
    };

    const response = await this.request<JsonApiResponse<PostAttributes>>(
      "PATCH",
      `/api/posts/${id}`,
      body
    );

    const posts = this.parsePosts(response);
    return posts[0];
  }

  /**
   * Delete post
   * @param id Post ID
   * @param permanent Whether to permanently delete (default false = soft delete/hide)
   */
  async deletePost(id: string, permanent: boolean = false): Promise<void> {
    if (permanent) {
      // Permanent deletion (requires admin rights)
      await this.request<void>("DELETE", `/api/posts/${id}`);
    } else {
      // Soft delete/hide (regular users can do this to their own posts)
      await this.request<JsonApiResponse<PostAttributes>>("PATCH", `/api/posts/${id}`, {
        data: {
          type: "posts",
          id,
          attributes: {
            isHidden: true,
          },
        },
      });
    }
  }

  // ==================== Tag API ====================

  /**
   * Get all tags
   */
  async getTags(): Promise<Tag[]> {
    const response = await this.request<JsonApiResponse<TagAttributes>>(
      "GET",
      "/api/tags"
    );

    return this.parseTags(response);
  }

  // ==================== User API ====================

  /**
   * Get user list
   */
  async getUsers(params?: ListParams): Promise<User[]> {
    const queryParts: string[] = [];

    if (params?.limit) {
      queryParts.push(`page[limit]=${params.limit}`);
    }
    if (params?.offset) {
      queryParts.push(`page[offset]=${params.offset}`);
    }

    // Search by username or display name
    if (params?.search) {
      queryParts.push(`filter[q]=${encodeURIComponent(params.search)}`);
    }

    const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
    const response = await this.request<JsonApiResponse<UserAttributes>>(
      "GET",
      `/api/users${query}`
    );

    return this.parseUsers(response);
  }

  /**
   * Get a single user
   */
  async getUser(id: string): Promise<User> {
    const response = await this.request<JsonApiResponse<UserAttributes>>(
      "GET",
      `/api/users/${id}`
    );

    const users = this.parseUsers(response);
    if (users.length === 0) {
      throw new Error(`User ${id} not found`);
    }
    return users[0];
  }

  // ==================== Data parsing methods ====================

  private buildIncludedMap(included: import("./types.js").JsonApiResource[] = []): Map<string, unknown> {
    const map = new Map<string, unknown>();
    for (const item of included) {
      map.set(`${item.type}:${item.id}`, item);
    }
    return map;
  }

  /**
   * Parse discussion data
   */
  private parseDiscussions(
    response: JsonApiResponse<DiscussionAttributes>
  ): Discussion[] {
    const data = Array.isArray(response.data) ? response.data : [response.data];
    const includedMap = this.buildIncludedMap(response.included);

    return data.map((item) => {
      const discussion: Discussion = {
        id: item.id,
        title: item.attributes.title,
        slug: item.attributes.slug,
        commentCount: item.attributes.commentCount,
        participantCount: item.attributes.participantCount,
        createdAt: item.attributes.createdAt,
        lastPostedAt: item.attributes.lastPostedAt,
      };

      // Parse author
      const userRef = item.relationships?.user?.data;
      if (userRef && !Array.isArray(userRef)) {
        const user = includedMap.get(`users:${userRef.id}`);
        if (user) {
          const attrs = (user as { attributes: UserAttributes }).attributes;
          discussion.author = {
            id: userRef.id,
            username: attrs.username,
            displayName: attrs.displayName,
          };
        }
      }

      // Parse tags
      const tagsRef = item.relationships?.tags?.data;
      if (tagsRef && Array.isArray(tagsRef)) {
        discussion.tags = tagsRef
          .map((ref) => {
            const tag = includedMap.get(`tags:${ref.id}`);
            if (tag) {
              const attrs = (tag as { attributes: TagAttributes }).attributes;
              return {
                id: ref.id,
                name: attrs.name,
                slug: attrs.slug,
              };
            }
            return null;
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);
      }

      // Parse first post
      const firstPostRef = item.relationships?.firstPost?.data;
      if (firstPostRef && !Array.isArray(firstPostRef)) {
        const post = includedMap.get(`posts:${firstPostRef.id}`);
        if (post) {
          const attrs = (post as { attributes: PostAttributes }).attributes;
          discussion.firstPost = {
            id: firstPostRef.id,
            content: attrs.content,
            contentHtml: attrs.contentHtml,
          };
        }
      }

      return discussion;
    });
  }

  /**
   * Parse post data
   */
  private parsePosts(
    response: JsonApiResponse<PostAttributes>,
    discussionId?: string
  ): Post[] {
    const data = Array.isArray(response.data) ? response.data : [response.data];
    const includedMap = this.buildIncludedMap(response.included);

    return data.map((item) => {
      const post: Post = {
        id: item.id,
        number: item.attributes.number,
        content: item.attributes.content,
        contentHtml: item.attributes.contentHtml,
        createdAt: item.attributes.createdAt,
        editedAt: item.attributes.editedAt,
        discussionId,
      };

      // Parse author
      const userRef = item.relationships?.user?.data;
      if (userRef && !Array.isArray(userRef)) {
        const user = includedMap.get(`users:${userRef.id}`);
        if (user) {
          const attrs = (user as { attributes: UserAttributes }).attributes;
          post.author = {
            id: userRef.id,
            username: attrs.username,
            displayName: attrs.displayName,
          };
        }
      }

      // Parse discussion ID
      const discussionRef = item.relationships?.discussion?.data;
      if (discussionRef && !Array.isArray(discussionRef)) {
        post.discussionId = discussionRef.id;
      }

      return post;
    });
  }

  /**
   * Parse tag data
   */
  private parseTags(response: JsonApiResponse<TagAttributes>): Tag[] {
    const data = Array.isArray(response.data) ? response.data : [response.data];

    return data.map((item) => ({
      id: item.id,
      name: item.attributes.name,
      slug: item.attributes.slug,
      color: item.attributes.color,
    }));
  }

  /**
   * Parse user data
   */
  private parseUsers(response: JsonApiResponse<UserAttributes>): User[] {
    const data = Array.isArray(response.data) ? response.data : [response.data];

    return data.map((item) => ({
      id: item.id,
      username: item.attributes.username,
      displayName: item.attributes.displayName,
      avatarUrl: item.attributes.avatarUrl,
      joinTime: item.attributes.joinTime,
      discussionCount: item.attributes.discussionCount,
      commentCount: item.attributes.commentCount,
    }));
  }
}

// Export singleton instance
export const flarumClient = new FlarumClient();
