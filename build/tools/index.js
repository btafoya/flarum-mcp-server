/**
 * MCP tool definitions and handling
 */
import { ListToolsRequestSchema, CallToolRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { flarumClient } from "../flarum-client.js";
function jsonText(value) {
    return { type: "text", text: JSON.stringify(value, null, 2) };
}
/**
 * Tool definitions
 */
const tools = [
    // ==================== Authentication tools ====================
    {
        name: "flarum_login",
        title: "Login",
        description: "Login to the Flarum forum to get an access token",
        annotations: { openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                identification: {
                    type: "string",
                    description: "Username or email address",
                },
                password: {
                    type: "string",
                    description: "User password",
                },
                remember: {
                    type: "boolean",
                    description: "Whether to remember login (extends token validity to 5 years)",
                    default: false,
                },
            },
            required: ["identification", "password"],
        },
    },
    {
        name: "flarum_logout",
        title: "Logout",
        description: "Logout from the Flarum forum and clear the current session",
        annotations: { openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "flarum_check_auth",
        title: "Check Authentication",
        description: "Check current login status",
        annotations: { readOnlyHint: true },
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    // ==================== Discussion tools ====================
    {
        name: "flarum_list_discussions",
        title: "List Discussions",
        description: "Get forum discussion list, supports filtering by user and tag",
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Number of results (1-50)",
                    default: 20,
                },
                offset: {
                    type: "number",
                    description: "Pagination offset",
                    default: 0,
                },
                sort: {
                    type: "string",
                    description: "Sort order: -lastPostedAt, -createdAt, -commentCount",
                    default: "-lastPostedAt",
                },
                search: {
                    type: "string",
                    description: "Search keyword",
                },
                userId: {
                    type: "string",
                    description: "Filter by user ID (get discussions posted by the specified user)",
                },
                username: {
                    type: "string",
                    description: "Filter by username (get discussions posted by the specified user). Note: the forum username is the pinyin of Chinese display names (no spaces, lowercase). For example, convert a Chinese display name to its pinyin form. If the user provides a Chinese name, convert it to pinyin before searching.",
                },
                tag: {
                    type: "string",
                    description: "Filter by tag slug (get discussions under the specified tag)",
                },
                createdAfter: {
                    type: "string",
                    description: "Filter discussions created after this date (format: YYYY-MM-DD, e.g. 2024-01-01)",
                },
                createdBefore: {
                    type: "string",
                    description: "Filter discussions created before this date (format: YYYY-MM-DD, e.g. 2024-12-31)",
                },
            },
        },
    },
    {
        name: "flarum_get_discussion",
        title: "Get Discussion",
        description: "Get detailed information of a single discussion",
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Discussion ID",
                },
            },
            required: ["id"],
        },
    },
    {
        name: "flarum_create_discussion",
        title: "Create Discussion",
        description: "Create a new discussion topic (login required)",
        annotations: { openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Discussion title",
                },
                content: {
                    type: "string",
                    description: "Discussion content (Markdown supported)",
                },
                tagIds: {
                    type: "array",
                    items: { type: "string" },
                    description: "Tag ID array",
                },
            },
            required: ["title", "content"],
        },
    },
    {
        name: "flarum_update_discussion",
        title: "Update Discussion",
        description: "Update discussion info (login required, can only edit your own discussions)",
        annotations: { openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Discussion ID",
                },
                title: {
                    type: "string",
                    description: "New discussion title",
                },
            },
            required: ["id"],
        },
    },
    {
        name: "flarum_delete_discussion",
        title: "Delete Discussion",
        description: "Delete discussion (login required, can only delete your own discussions)",
        annotations: { destructiveHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Discussion ID",
                },
                permanent: {
                    type: "boolean",
                    description: "Whether to permanently delete (default false = soft delete/hide, true requires admin rights)",
                    default: false,
                },
            },
            required: ["id"],
        },
    },
    {
        name: "flarum_list_tags",
        title: "List Tags",
        description: "Get all forum tags",
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    // ==================== User tools ====================
    {
        name: "flarum_list_users",
        title: "List Users",
        description: "Get forum user list",
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                limit: {
                    type: "number",
                    description: "Number of results (1-50)",
                    default: 20,
                },
                offset: {
                    type: "number",
                    description: "Pagination offset",
                    default: 0,
                },
                search: {
                    type: "string",
                    description: "Search keyword (matches username or display name)",
                },
            },
        },
    },
    {
        name: "flarum_get_user",
        title: "Get User",
        description: "Get detailed information of a single user",
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "User ID",
                },
            },
            required: ["id"],
        },
    },
    // ==================== Post tools ====================
    {
        name: "flarum_list_posts",
        title: "List Posts",
        description: "Get all replies in the specified discussion",
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                discussionId: {
                    type: "string",
                    description: "Discussion ID",
                },
                limit: {
                    type: "number",
                    description: "Number of results (1-50)",
                    default: 20,
                },
                offset: {
                    type: "number",
                    description: "Pagination offset",
                    default: 0,
                },
            },
            required: ["discussionId"],
        },
    },
    {
        name: "flarum_get_post",
        title: "Get Post",
        description: "Get detailed information of a single post",
        annotations: { readOnlyHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Post ID",
                },
            },
            required: ["id"],
        },
    },
    {
        name: "flarum_create_post",
        title: "Create Post",
        description: "Create a new reply in a discussion (login required)",
        annotations: { openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                discussionId: {
                    type: "string",
                    description: "Discussion ID",
                },
                content: {
                    type: "string",
                    description: "Reply content (Markdown supported)",
                },
            },
            required: ["discussionId", "content"],
        },
    },
    {
        name: "flarum_update_post",
        title: "Update Post",
        description: "Update post content (login required, can only edit your own posts)",
        annotations: { openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Post ID",
                },
                content: {
                    type: "string",
                    description: "New post content (Markdown supported)",
                },
            },
            required: ["id", "content"],
        },
    },
    {
        name: "flarum_delete_post",
        title: "Delete Post",
        description: "Delete post (login required, can only delete your own posts)",
        annotations: { destructiveHint: true, openWorldHint: true },
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "Post ID",
                },
                permanent: {
                    type: "boolean",
                    description: "Whether to permanently delete (default false = soft delete/hide, true requires admin rights)",
                    default: false,
                },
            },
            required: ["id"],
        },
    },
];
/**
 * Tool call handler
 */
async function handleToolCall(name, args) {
    try {
        switch (name) {
            // ==================== Authentication tools ====================
            case "flarum_login": {
                const result = await flarumClient.login(args.identification, args.password, args.remember);
                return {
                    content: [jsonText({
                            success: true,
                            message: "Login successful",
                            userId: result.userId,
                            tokenPreview: `${result.token.substring(0, 8)}...`,
                        })],
                };
            }
            case "flarum_logout": {
                flarumClient.logout();
                return {
                    content: [{ type: "text", text: "Logged out successfully" }],
                };
            }
            case "flarum_check_auth": {
                const isAuthenticated = flarumClient.isAuthenticated();
                return {
                    content: [jsonText({
                            isAuthenticated,
                            message: isAuthenticated
                                ? "Logged in, authenticated operations are allowed"
                                : "Not logged in, please use the flarum_login tool first",
                        })],
                };
            }
            // ==================== Discussion tools ====================
            case "flarum_list_discussions": {
                const discussions = await flarumClient.getDiscussions({
                    limit: args.limit || 20,
                    offset: args.offset || 0,
                    sort: args.sort || "-lastPostedAt",
                    search: args.search,
                    userId: args.userId,
                    username: args.username,
                    tag: args.tag,
                    createdAfter: args.createdAfter,
                    createdBefore: args.createdBefore,
                });
                const formatted = discussions.map((d) => ({
                    id: d.id,
                    title: d.title,
                    author: d.author?.displayName || "Unknown",
                    commentCount: d.commentCount,
                    createdAt: d.createdAt,
                    lastPostedAt: d.lastPostedAt,
                    tags: d.tags?.map((t) => t.name).join(", ") || "",
                }));
                return {
                    content: [jsonText({ total: formatted.length, discussions: formatted })],
                };
            }
            case "flarum_get_discussion": {
                const discussion = await flarumClient.getDiscussion(args.id);
                return {
                    content: [jsonText({
                            id: discussion.id,
                            title: discussion.title,
                            author: discussion.author?.displayName || "Unknown",
                            commentCount: discussion.commentCount,
                            participantCount: discussion.participantCount,
                            createdAt: discussion.createdAt,
                            lastPostedAt: discussion.lastPostedAt,
                            tags: discussion.tags?.map((t) => t.name) || [],
                            firstPost: discussion.firstPost
                                ? {
                                    id: discussion.firstPost.id,
                                    content: discussion.firstPost.content,
                                }
                                : null,
                        })],
                };
            }
            case "flarum_create_discussion": {
                if (!flarumClient.isAuthenticated()) {
                    return {
                        content: [
                            { type: "text", text: "Error: please use the flarum_login tool first" },
                        ],
                        isError: true,
                    };
                }
                const discussion = await flarumClient.createDiscussion({
                    title: args.title,
                    content: args.content,
                    tagIds: args.tagIds,
                });
                return {
                    content: [jsonText({
                            success: true,
                            message: "Discussion created successfully",
                            discussion: {
                                id: discussion.id,
                                title: discussion.title,
                                slug: discussion.slug,
                                createdAt: discussion.createdAt,
                            },
                        })],
                };
            }
            case "flarum_update_discussion": {
                if (!flarumClient.isAuthenticated()) {
                    return {
                        content: [
                            { type: "text", text: "Error: please use the flarum_login tool first" },
                        ],
                        isError: true,
                    };
                }
                const updatedDiscussion = await flarumClient.updateDiscussion(args.id, { title: args.title });
                return {
                    content: [jsonText({
                            success: true,
                            message: "Discussion updated successfully",
                            discussion: {
                                id: updatedDiscussion.id,
                                title: updatedDiscussion.title,
                            },
                        })],
                };
            }
            case "flarum_delete_discussion": {
                if (!flarumClient.isAuthenticated()) {
                    return {
                        content: [
                            { type: "text", text: "Error: please use the flarum_login tool first" },
                        ],
                        isError: true,
                    };
                }
                const permanentDiscussion = args.permanent || false;
                await flarumClient.deleteDiscussion(args.id, permanentDiscussion);
                return {
                    content: [jsonText({
                            success: true,
                            message: permanentDiscussion
                                ? `Discussion ${args.id} permanently deleted`
                                : `Discussion ${args.id} hidden (soft deleted)`,
                        })],
                };
            }
            case "flarum_list_tags": {
                const tags = await flarumClient.getTags();
                return {
                    content: [jsonText({
                            total: tags.length,
                            tags: tags.map((t) => ({
                                id: t.id,
                                name: t.name,
                                slug: t.slug,
                                color: t.color,
                            })),
                        })],
                };
            }
            // ==================== User tools ====================
            case "flarum_list_users": {
                const users = await flarumClient.getUsers({
                    limit: args.limit || 20,
                    offset: args.offset || 0,
                    search: args.search,
                });
                const formattedUsers = users.map((u) => ({
                    id: u.id,
                    username: u.username,
                    displayName: u.displayName,
                    joinTime: u.joinTime,
                    discussionCount: u.discussionCount,
                    commentCount: u.commentCount,
                }));
                return {
                    content: [jsonText({ total: formattedUsers.length, users: formattedUsers })],
                };
            }
            case "flarum_get_user": {
                const user = await flarumClient.getUser(args.id);
                return {
                    content: [jsonText({
                            id: user.id,
                            username: user.username,
                            displayName: user.displayName,
                            avatarUrl: user.avatarUrl,
                            joinTime: user.joinTime,
                            discussionCount: user.discussionCount,
                            commentCount: user.commentCount,
                        })],
                };
            }
            // ==================== Post tools ====================
            case "flarum_list_posts": {
                const posts = await flarumClient.getPosts(args.discussionId, {
                    limit: args.limit || 20,
                    offset: args.offset || 0,
                });
                const formattedPosts = posts.map((p) => ({
                    id: p.id,
                    number: p.number,
                    author: p.author?.displayName || "Unknown",
                    content: p.content,
                    createdAt: p.createdAt,
                    editedAt: p.editedAt,
                }));
                return {
                    content: [jsonText({
                            discussionId: args.discussionId,
                            total: formattedPosts.length,
                            posts: formattedPosts,
                        })],
                };
            }
            case "flarum_get_post": {
                const post = await flarumClient.getPost(args.id);
                return {
                    content: [jsonText({
                            id: post.id,
                            number: post.number,
                            author: post.author?.displayName || "Unknown",
                            content: post.content,
                            contentHtml: post.contentHtml,
                            createdAt: post.createdAt,
                            editedAt: post.editedAt,
                            discussionId: post.discussionId,
                        })],
                };
            }
            case "flarum_create_post": {
                if (!flarumClient.isAuthenticated()) {
                    return {
                        content: [
                            { type: "text", text: "Error: please use the flarum_login tool first" },
                        ],
                        isError: true,
                    };
                }
                const newPost = await flarumClient.createPost({
                    discussionId: args.discussionId,
                    content: args.content,
                });
                return {
                    content: [jsonText({
                            success: true,
                            message: "Reply created successfully",
                            post: {
                                id: newPost.id,
                                number: newPost.number,
                                createdAt: newPost.createdAt,
                            },
                        })],
                };
            }
            case "flarum_update_post": {
                if (!flarumClient.isAuthenticated()) {
                    return {
                        content: [
                            { type: "text", text: "Error: please use the flarum_login tool first" },
                        ],
                        isError: true,
                    };
                }
                const updatedPost = await flarumClient.updatePost(args.id, {
                    content: args.content,
                });
                return {
                    content: [jsonText({
                            success: true,
                            message: "Post updated successfully",
                            post: {
                                id: updatedPost.id,
                                number: updatedPost.number,
                                editedAt: updatedPost.editedAt,
                            },
                        })],
                };
            }
            case "flarum_delete_post": {
                if (!flarumClient.isAuthenticated()) {
                    return {
                        content: [
                            { type: "text", text: "Error: please use the flarum_login tool first" },
                        ],
                        isError: true,
                    };
                }
                const permanent = args.permanent || false;
                await flarumClient.deletePost(args.id, permanent);
                return {
                    content: [jsonText({
                            success: true,
                            message: permanent
                                ? `Post ${args.id} permanently deleted`
                                : `Post ${args.id} hidden (soft deleted)`,
                        })],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
}
/**
 * Register all MCP tools
 */
export function registerTools(server) {
    // List tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });
    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        return handleToolCall(name, (args || {}));
    });
}
//# sourceMappingURL=index.js.map