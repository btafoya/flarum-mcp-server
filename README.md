# Flarum MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for [Flarum](https://flarum.org/) forums. This allows Claude Code and other MCP clients to interact with Flarum forums - creating, reading, updating, and deleting discussions, posts, users, and tags.

## Installation

### Global install (recommended)

```bash
npm install -g @btafoya/flarum-mcp-server
```

### npx (no install)

```bash
npx @btafoya/flarum-mcp-server
```

## Claude Code CLI

Add the server to Claude Code:

```bash
claude mcp add flarum --json '{"command":"flarum-mcp-server","env":{"FLARUM_BASE_URL":"https://your-forum.com","FLARUM_USERNAME":"your-email@example.com","FLARUM_PASSWORD":"your-password"}}'
```

Or edit `~/.claude/settings.json` directly:

```json
{
  "mcpServers": {
    "flarum": {
      "command": "flarum-mcp-server",
      "env": {
        "FLARUM_BASE_URL": "https://your-forum.com",
        "FLARUM_USERNAME": "your-email@example.com",
        "FLARUM_PASSWORD": "your-password"
      }
    }
  }
}
```

Remove the server from Claude Code:

```bash
claude mcp remove flarum
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FLARUM_BASE_URL` | Yes | Your Flarum forum URL |
| `FLARUM_USERNAME` | No | Email or username for auto-login |
| `FLARUM_PASSWORD` | No | Password for auto-login |

## Available Tools

### Discussions

| Tool | Description |
|------|-------------|
| `flarum_list_discussions` | List discussions (supports filtering by user, tag, date) |
| `flarum_get_discussion` | Get discussion details |
| `flarum_create_discussion` | Create a new discussion |
| `flarum_update_discussion` | Update a discussion |
| `flarum_delete_discussion` | Delete/hide a discussion |

### Posts

| Tool | Description |
|------|-------------|
| `flarum_list_posts` | List posts in a discussion |
| `flarum_get_post` | Get post details |
| `flarum_create_post` | Create a reply |
| `flarum_update_post` | Update a post |
| `flarum_delete_post` | Delete/hide a post |

### Users

| Tool | Description |
|------|-------------|
| `flarum_list_users` | List users (supports search) |
| `flarum_get_user` | Get user details |
| `flarum_create_user` | Create a new user |
| `flarum_update_user` | Update a user |
| `flarum_delete_user` | Delete a user |

### Tags

| Tool | Description |
|------|-------------|
| `flarum_list_tags` | List all tags |

### Authentication

| Tool | Description |
|------|-------------|
| `flarum_login` | Login to the forum |
| `flarum_logout` | Logout |
| `flarum_check_auth` | Check authentication status |

## Usage Examples

In Claude Code, you can say:

- "List the latest 10 discussions"
- "Create a new discussion titled 'Hello World' with content 'This is my first post'"
- "Reply to discussion 123 with 'Thanks for sharing!'"
- "Show me all discussions by user john"
- "Get discussions created after 2024-01-01"

## Features

- **Auto-login**: Configure credentials in environment variables for automatic authentication
- **Token caching**: Tokens are cached locally (`~/.flarum-mcp-token.json`) with 5-year expiration
- **Filtering**: Filter discussions by user, tag, and date range
- **Soft delete**: Default delete operation hides content (recoverable), with option for permanent deletion

## Requirements

- Node.js >= 18.0.0
- A Flarum forum with API access

## Development

```bash
# Clone and install dependencies
git clone https://github.com/btafoya/flarum-mcp-server.git
cd flarum-mcp-server
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## License

MIT
