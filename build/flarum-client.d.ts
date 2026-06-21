/**
 * Flarum API client
 * Wraps all HTTP interaction with the Flarum forum
 */
import type { LoginResult, Discussion, Post, Tag, User, ListParams, CreateDiscussionParams, UpdateDiscussionParams, CreatePostParams, UpdatePostParams, CreateUserParams, UpdateUserParams, CreateTagParams, UpdateTagParams } from "./types.js";
export declare class FlarumClient {
    private baseUrl;
    private token;
    private userId;
    private cacheFilePath;
    private requestTimeoutMs;
    constructor(baseUrl?: string, options?: {
        cacheFilePath?: string;
        requestTimeoutMs?: number;
    });
    /**
     * Load cached token from file
     */
    loadCachedToken(): boolean;
    /**
     * Save token to file
     */
    private saveCachedToken;
    /**
     * Clear cached token
     */
    clearCachedToken(): void;
    /**
     * Validate whether the current token is valid
     */
    validateToken(): Promise<boolean>;
    /**
     * Set authentication token
     */
    setToken(token: string, userId?: string): void;
    /**
     * Get current token
     */
    getToken(): string | null;
    /**
     * Check whether logged in
     */
    isAuthenticated(): boolean;
    /**
     * Build request headers
     */
    private getHeaders;
    /**
     * Send HTTP request
     */
    private request;
    /**
     * Login to get token
     */
    login(identification: string, password: string, remember?: boolean): Promise<LoginResult>;
    /**
     * Logout
     */
    logout(): void;
    /**
     * Get discussion list
     */
    getDiscussions(params?: ListParams): Promise<Discussion[]>;
    /**
     * Get a single discussion
     */
    getDiscussion(id: string): Promise<Discussion>;
    /**
     * Create discussion
     */
    createDiscussion(params: CreateDiscussionParams): Promise<Discussion>;
    /**
     * Update discussion
     */
    updateDiscussion(id: string, params: UpdateDiscussionParams): Promise<Discussion>;
    /**
     * Delete discussion
     * @param id Discussion ID
     * @param permanent Whether to permanently delete (default false = soft delete/hide)
     */
    deleteDiscussion(id: string, permanent?: boolean): Promise<void>;
    /**
     * Get post list for a discussion
     */
    getPosts(discussionId: string, params?: ListParams): Promise<Post[]>;
    /**
     * Get a single post
     */
    getPost(id: string): Promise<Post>;
    /**
     * Create post (reply)
     */
    createPost(params: CreatePostParams): Promise<Post>;
    /**
     * Update post
     */
    updatePost(id: string, params: UpdatePostParams): Promise<Post>;
    /**
     * Delete post
     * @param id Post ID
     * @param permanent Whether to permanently delete (default false = soft delete/hide)
     */
    deletePost(id: string, permanent?: boolean): Promise<void>;
    /**
     * Get all tags
     */
    getTags(): Promise<Tag[]>;
    /**
     * Create a new tag (category)
     */
    createTag(params: CreateTagParams): Promise<Tag>;
    /**
     * Update an existing tag (category)
     */
    updateTag(id: string, params: UpdateTagParams): Promise<Tag>;
    /**
     * Delete a tag (category)
     * @param id Tag ID
     */
    deleteTag(id: string): Promise<void>;
    /**
     * Get user list
     */
    getUsers(params?: ListParams): Promise<User[]>;
    /**
     * Get a single user
     */
    getUser(id: string): Promise<User>;
    /**
     * Create user
     */
    createUser(params: CreateUserParams): Promise<User>;
    /**
     * Update user
     */
    updateUser(id: string, params: UpdateUserParams): Promise<User>;
    /**
     * Delete user
     */
    deleteUser(id: string): Promise<void>;
    private buildIncludedMap;
    /**
     * Parse discussion data
     */
    private parseDiscussions;
    /**
     * Parse post data
     */
    private parsePosts;
    /**
     * Parse tag data
     */
    private parseTags;
    /**
     * Parse user data
     */
    private parseUsers;
}
export declare const flarumClient: FlarumClient;
//# sourceMappingURL=flarum-client.d.ts.map