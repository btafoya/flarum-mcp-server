/**
 * Flarum API client
 * Wraps all HTTP interaction with the Flarum forum
 */
import { readFileSync, writeFileSync, existsSync, constants } from "fs";
import { join } from "path";
import { homedir } from "os";
export class FlarumClient {
    baseUrl;
    token = null;
    userId = null;
    cacheFilePath;
    requestTimeoutMs;
    constructor(baseUrl, options) {
        this.baseUrl = baseUrl || process.env.FLARUM_BASE_URL || "http://localhost";
        // Remove trailing slash
        this.baseUrl = this.baseUrl.replace(/\/$/, "");
        // Cache file path: ~/.flarum-mcp-token.json under the user directory
        this.cacheFilePath = options?.cacheFilePath || join(homedir(), ".flarum-mcp-token.json");
        // ponytail: default 30s; override for tests or slow hosts
        this.requestTimeoutMs = options?.requestTimeoutMs ?? 30000;
    }
    /**
     * Load cached token from file
     */
    loadCachedToken() {
        try {
            if (!existsSync(this.cacheFilePath)) {
                return false;
            }
            const data = readFileSync(this.cacheFilePath, "utf-8");
            const cache = JSON.parse(data);
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
        }
        catch (error) {
            console.error("Failed to load token cache:", error);
            return false;
        }
    }
    /**
     * Save token to file
     */
    saveCachedToken() {
        if (!this.token || !this.userId) {
            return;
        }
        try {
            const cache = {
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
        }
        catch (error) {
            console.error("Failed to save token cache:", error);
        }
    }
    /**
     * Clear cached token
     */
    clearCachedToken() {
        try {
            if (existsSync(this.cacheFilePath)) {
                writeFileSync(this.cacheFilePath, "{}", "utf-8");
            }
        }
        catch (error) {
            console.error("Failed to clear token cache:", error);
        }
    }
    /**
     * Validate whether the current token is valid
     */
    async validateToken() {
        if (!this.token) {
            return false;
        }
        try {
            // Try accessing an authenticated API to validate the token
            await this.request("GET", "/api/users/me");
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Set authentication token
     */
    setToken(token, userId) {
        this.token = token;
        if (userId) {
            this.userId = userId;
        }
    }
    /**
     * Get current token
     */
    getToken() {
        return this.token;
    }
    /**
     * Check whether logged in
     */
    isAuthenticated() {
        return this.token !== null;
    }
    /**
     * Build request headers
     */
    getHeaders() {
        const headers = {
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
    async request(method, endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
        const options = {
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
                return {};
            }
            const data = await response.json();
            if (!response.ok) {
                const errorData = data;
                const errorMessage = errorData.errors
                    ?.map((e) => e.detail || e.code)
                    .join(", ") || `HTTP ${response.status}`;
                throw new Error(errorMessage);
            }
            return data;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    // ==================== Authentication API ====================
    /**
     * Login to get token
     */
    async login(identification, password, remember) {
        const endpoint = remember ? "/api/token?remember=1" : "/api/token";
        const result = await this.request("POST", endpoint, {
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
    logout() {
        this.token = null;
        this.userId = null;
        // Clear cache file
        this.clearCachedToken();
    }
    // ==================== Discussion API ====================
    /**
     * Get discussion list
     */
    async getDiscussions(params) {
        const queryParts = [];
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
        const searchParts = [];
        // Keyword search
        if (params?.search) {
            searchParts.push(params.search);
        }
        // Filter by user (Gambit syntax author:username)
        if (params?.username) {
            searchParts.push(`author:${params.username}`);
        }
        else if (params?.userId) {
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
        }
        else if (params?.createdAfter) {
            // After date: created:>YYYY-MM-DD
            searchParts.push(`created:>${params.createdAfter}`);
        }
        else if (params?.createdBefore) {
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
        const response = await this.request("GET", `/api/discussions${query}`);
        return this.parseDiscussions(response);
    }
    /**
     * Get a single discussion
     */
    async getDiscussion(id) {
        const response = await this.request("GET", `/api/discussions/${id}?include=user,tags,firstPost`);
        const discussions = this.parseDiscussions(response);
        if (discussions.length === 0) {
            throw new Error(`Discussion ${id} not found`);
        }
        return discussions[0];
    }
    /**
     * Create discussion
     */
    async createDiscussion(params) {
        const body = {
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
            body.data.relationships = {
                tags: {
                    data: params.tagIds.map((id) => ({ type: "tags", id })),
                },
            };
        }
        const response = await this.request("POST", "/api/discussions", body);
        const discussions = this.parseDiscussions(response);
        return discussions[0];
    }
    /**
     * Update discussion
     */
    async updateDiscussion(id, params) {
        const attributes = {};
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
        const response = await this.request("PATCH", `/api/discussions/${id}`, body);
        const discussions = this.parseDiscussions(response);
        return discussions[0];
    }
    /**
     * Delete discussion
     * @param id Discussion ID
     * @param permanent Whether to permanently delete (default false = soft delete/hide)
     */
    async deleteDiscussion(id, permanent = false) {
        if (permanent) {
            // Permanent deletion (requires admin rights)
            await this.request("DELETE", `/api/discussions/${id}`);
        }
        else {
            // Soft delete/hide (regular users can do this to their own discussions)
            await this.request("PATCH", `/api/discussions/${id}`, {
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
    async getPosts(discussionId, params) {
        const queryParts = [`filter[discussion]=${discussionId}`];
        if (params?.limit) {
            queryParts.push(`page[limit]=${params.limit}`);
        }
        if (params?.offset) {
            queryParts.push(`page[offset]=${params.offset}`);
        }
        queryParts.push("include=user");
        const query = `?${queryParts.join("&")}`;
        const response = await this.request("GET", `/api/posts${query}`);
        return this.parsePosts(response, discussionId);
    }
    /**
     * Get a single post
     */
    async getPost(id) {
        const response = await this.request("GET", `/api/posts/${id}?include=user,discussion`);
        const posts = this.parsePosts(response);
        if (posts.length === 0) {
            throw new Error(`Post ${id} not found`);
        }
        return posts[0];
    }
    /**
     * Create post (reply)
     */
    async createPost(params) {
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
        const response = await this.request("POST", "/api/posts", body);
        const posts = this.parsePosts(response, params.discussionId);
        return posts[0];
    }
    /**
     * Update post
     */
    async updatePost(id, params) {
        const body = {
            data: {
                type: "posts",
                id,
                attributes: {
                    content: params.content,
                },
            },
        };
        const response = await this.request("PATCH", `/api/posts/${id}`, body);
        const posts = this.parsePosts(response);
        return posts[0];
    }
    /**
     * Delete post
     * @param id Post ID
     * @param permanent Whether to permanently delete (default false = soft delete/hide)
     */
    async deletePost(id, permanent = false) {
        if (permanent) {
            // Permanent deletion (requires admin rights)
            await this.request("DELETE", `/api/posts/${id}`);
        }
        else {
            // Soft delete/hide (regular users can do this to their own posts)
            await this.request("PATCH", `/api/posts/${id}`, {
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
    async getTags() {
        const response = await this.request("GET", "/api/tags");
        return this.parseTags(response);
    }
    /**
     * Create a new tag (category)
     */
    async createTag(params) {
        const attributes = {
            name: params.name,
        };
        if (params.slug !== undefined)
            attributes.slug = params.slug;
        if (params.description !== undefined)
            attributes.description = params.description;
        if (params.color !== undefined)
            attributes.color = params.color;
        if (params.icon !== undefined)
            attributes.icon = params.icon;
        if (params.isHidden !== undefined)
            attributes.isHidden = params.isHidden;
        if (params.isRestricted !== undefined)
            attributes.isRestricted = params.isRestricted;
        // ponytail: isChild is set automatically when a parent relationship is present
        const body = {
            data: {
                type: "tags",
                attributes,
                relationships: {},
            },
        };
        if (params.parentId) {
            body.data.relationships = {
                parent: {
                    data: { type: "tags", id: params.parentId },
                },
            };
        }
        const response = await this.request("POST", "/api/tags", body);
        const tags = this.parseTags(response);
        return tags[0];
    }
    /**
     * Update an existing tag (category)
     */
    async updateTag(id, params) {
        const attributes = {};
        if (params.name !== undefined)
            attributes.name = params.name;
        if (params.slug !== undefined)
            attributes.slug = params.slug;
        if (params.description !== undefined)
            attributes.description = params.description;
        if (params.color !== undefined)
            attributes.color = params.color;
        if (params.icon !== undefined)
            attributes.icon = params.icon;
        if (params.isHidden !== undefined)
            attributes.isHidden = params.isHidden;
        if (params.isRestricted !== undefined)
            attributes.isRestricted = params.isRestricted;
        const body = {
            data: {
                type: "tags",
                id,
                attributes,
            },
        };
        // ponytail: parentId is managed via relationships, not attributes
        if (params.parentId !== undefined) {
            body.data.relationships = {
                parent: {
                    data: params.parentId ? { type: "tags", id: params.parentId } : null,
                },
            };
        }
        const response = await this.request("PATCH", `/api/tags/${id}`, body);
        const tags = this.parseTags(response);
        return tags[0];
    }
    /**
     * Delete a tag (category)
     * @param id Tag ID
     */
    async deleteTag(id) {
        await this.request("DELETE", `/api/tags/${id}`);
    }
    // ==================== User API ====================
    /**
     * Get user list
     */
    async getUsers(params) {
        const queryParts = [];
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
        const response = await this.request("GET", `/api/users${query}`);
        return this.parseUsers(response);
    }
    /**
     * Get a single user
     */
    async getUser(id) {
        const response = await this.request("GET", `/api/users/${id}`);
        const users = this.parseUsers(response);
        if (users.length === 0) {
            throw new Error(`User ${id} not found`);
        }
        return users[0];
    }
    /**
     * Create user
     */
    async createUser(params) {
        const body = {
            data: {
                type: "users",
                attributes: {
                    username: params.username,
                    email: params.email,
                    password: params.password,
                },
            },
        };
        const response = await this.request("POST", "/api/users", body);
        const users = this.parseUsers(response);
        return users[0];
    }
    /**
     * Update user
     */
    async updateUser(id, params) {
        const attributes = {};
        if (params.username !== undefined) {
            attributes.username = params.username;
        }
        if (params.email !== undefined) {
            attributes.email = params.email;
        }
        if (params.password !== undefined) {
            attributes.password = params.password;
        }
        if (params.bio !== undefined) {
            attributes.bio = params.bio;
        }
        if (params.avatarUrl !== undefined) {
            attributes.avatarUrl = params.avatarUrl;
        }
        const body = {
            data: {
                type: "users",
                id,
                attributes,
            },
        };
        const response = await this.request("PATCH", `/api/users/${id}`, body);
        const users = this.parseUsers(response);
        return users[0];
    }
    /**
     * Delete user
     */
    async deleteUser(id) {
        await this.request("DELETE", `/api/users/${id}`);
    }
    // ==================== Data parsing methods ====================
    buildIncludedMap(included = []) {
        const map = new Map();
        for (const item of included) {
            map.set(`${item.type}:${item.id}`, item);
        }
        return map;
    }
    /**
     * Parse discussion data
     */
    parseDiscussions(response) {
        const data = Array.isArray(response.data) ? response.data : [response.data];
        const includedMap = this.buildIncludedMap(response.included);
        return data.map((item) => {
            const discussion = {
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
                    const attrs = user.attributes;
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
                        const attrs = tag.attributes;
                        return {
                            id: ref.id,
                            name: attrs.name,
                            slug: attrs.slug,
                        };
                    }
                    return null;
                })
                    .filter((t) => t !== null);
            }
            // Parse first post
            const firstPostRef = item.relationships?.firstPost?.data;
            if (firstPostRef && !Array.isArray(firstPostRef)) {
                const post = includedMap.get(`posts:${firstPostRef.id}`);
                if (post) {
                    const attrs = post.attributes;
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
    parsePosts(response, discussionId) {
        const data = Array.isArray(response.data) ? response.data : [response.data];
        const includedMap = this.buildIncludedMap(response.included);
        return data.map((item) => {
            const post = {
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
                    const attrs = user.attributes;
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
    parseTags(response) {
        const data = Array.isArray(response.data) ? response.data : [response.data];
        const includedMap = this.buildIncludedMap(response.included);
        const tags = data.map((item) => {
            const tag = {
                id: item.id,
                name: item.attributes.name,
                slug: item.attributes.slug,
                description: item.attributes.description ?? null,
                color: item.attributes.color,
                icon: item.attributes.icon ?? null,
                discussionCount: item.attributes.discussionCount,
                postCount: item.attributes.postCount,
                position: item.attributes.position ?? null,
                isChild: item.attributes.isChild,
                isHidden: item.attributes.isHidden,
                isRestricted: item.attributes.isRestricted,
                lastPostedAt: item.attributes.lastPostedAt ?? null,
                canStartDiscussion: item.attributes.canStartDiscussion,
                canAddToDiscussion: item.attributes.canAddToDiscussion,
                backgroundUrl: item.attributes.backgroundUrl ?? null,
                backgroundMode: item.attributes.backgroundMode ?? null,
                defaultSort: item.attributes.defaultSort ?? null,
            };
            const parentRef = item.relationships?.parent?.data;
            if (parentRef && !Array.isArray(parentRef)) {
                tag.parentId = parentRef.id;
                const parent = includedMap.get(`tags:${parentRef.id}`);
                if (parent) {
                    const attrs = parent.attributes;
                    tag.parent = {
                        id: parentRef.id,
                        name: attrs.name,
                        slug: attrs.slug,
                        description: attrs.description ?? null,
                        color: attrs.color,
                        icon: attrs.icon ?? null,
                        discussionCount: attrs.discussionCount,
                        postCount: attrs.postCount,
                        position: attrs.position ?? null,
                        isChild: attrs.isChild,
                        isHidden: attrs.isHidden,
                        isRestricted: attrs.isRestricted,
                        lastPostedAt: attrs.lastPostedAt ?? null,
                        canStartDiscussion: attrs.canStartDiscussion,
                        canAddToDiscussion: attrs.canAddToDiscussion,
                        backgroundUrl: attrs.backgroundUrl ?? null,
                        backgroundMode: attrs.backgroundMode ?? null,
                        defaultSort: attrs.defaultSort ?? null,
                    };
                }
            }
            return tag;
        });
        // ponytail: build child lists from parentId so callers get a tree view
        const tagMap = new Map(tags.map((t) => [t.id, t]));
        for (const tag of tags) {
            if (tag.parentId) {
                const parent = tagMap.get(tag.parentId);
                if (parent) {
                    parent.children = parent.children || [];
                    parent.children.push(tag);
                }
            }
        }
        return tags;
    }
    /**
     * Parse user data
     */
    parseUsers(response) {
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
//# sourceMappingURL=flarum-client.js.map