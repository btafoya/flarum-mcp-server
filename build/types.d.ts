/**
 * Flarum API type definitions
 */
export interface JsonApiResource<T = Record<string, unknown>> {
    type: string;
    id: string;
    attributes: T;
    relationships?: Record<string, {
        data: {
            type: string;
            id: string;
        } | {
            type: string;
            id: string;
        }[] | null;
    }>;
}
export interface JsonApiResponse<T = Record<string, unknown>> {
    data: JsonApiResource<T> | JsonApiResource<T>[];
    included?: JsonApiResource[];
    links?: {
        first?: string;
        last?: string;
        next?: string;
        prev?: string;
    };
}
export interface JsonApiError {
    status: string;
    code: string;
    detail: string;
    source?: {
        pointer?: string;
    };
}
export interface JsonApiErrorResponse {
    errors: JsonApiError[];
}
export interface LoginResult {
    token: string;
    userId: string;
}
export interface UserAttributes {
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    slug: string;
    email?: string;
    joinTime?: string;
    discussionCount?: number;
    commentCount?: number;
}
export interface User {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    joinTime?: string;
    discussionCount?: number;
    commentCount?: number;
}
export interface DiscussionAttributes {
    title: string;
    slug: string;
    commentCount: number;
    participantCount: number;
    createdAt: string;
    lastPostedAt: string | null;
    lastPostNumber: number;
    canReply: boolean;
    canRename: boolean;
    canDelete: boolean;
    canHide: boolean;
    isSticky?: boolean;
    isLocked?: boolean;
}
export interface Discussion {
    id: string;
    title: string;
    slug: string;
    commentCount: number;
    participantCount: number;
    createdAt: string;
    lastPostedAt: string | null;
    author?: {
        id: string;
        username: string;
        displayName: string;
    };
    tags?: Array<{
        id: string;
        name: string;
        slug: string;
    }>;
    firstPost?: {
        id: string;
        content: string;
        contentHtml: string;
    };
}
export interface PostAttributes {
    number: number;
    contentType: string;
    content: string;
    contentHtml: string;
    createdAt: string;
    editedAt: string | null;
    canEdit?: boolean;
    canDelete?: boolean;
    canHide?: boolean;
}
export interface Post {
    id: string;
    number: number;
    content: string;
    contentHtml: string;
    createdAt: string;
    editedAt: string | null;
    author?: {
        id: string;
        username: string;
        displayName: string;
    };
    discussionId?: string;
}
export interface TagAttributes {
    name: string;
    description: string;
    slug: string;
    color: string;
    icon?: string;
    discussionCount: number;
    position?: number;
    isChild: boolean;
    isHidden: boolean;
}
export interface Tag {
    id: string;
    name: string;
    slug: string;
    color: string;
}
export interface ListParams {
    limit?: number;
    offset?: number;
    sort?: string;
    search?: string;
    userId?: string;
    username?: string;
    tag?: string;
    createdAfter?: string;
    createdBefore?: string;
}
export interface CreateDiscussionParams {
    title: string;
    content: string;
    tagIds?: string[];
}
export interface UpdateDiscussionParams {
    title?: string;
    isSticky?: boolean;
    isLocked?: boolean;
}
export interface CreatePostParams {
    discussionId: string;
    content: string;
}
export interface UpdatePostParams {
    content: string;
}
export interface CreateUserParams {
    username: string;
    email: string;
    password: string;
}
export interface UpdateUserParams {
    username?: string;
    email?: string;
    password?: string;
    bio?: string;
    avatarUrl?: string;
}
//# sourceMappingURL=types.d.ts.map