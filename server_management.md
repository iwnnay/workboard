# The Need

I want to add in a feature that will maintain and launch my other dev servers and then show me the status of the
servers. I'm collecting quite a few small apps that pretty much all need servers in my ~/projects directory,
including this one. I also run this location in a safe place likes it's a production server. I'll need to add in a
new

# Server Types

## Python servers

Some of the applications are Python based, I try to make sure all of them run with the command `uv run start_server`.
This is also the default server start method for the Nacelle suite, so if I use Nacelle to build a Python application
it will be started with a single command like that in both dev and in production. You can assume that if it has a
.pyproject.toml file

## SvelteKit Servers

The rest of the applications are Svelte based servers that will run with the command `npm run dev` and maybe have a
port option passed to it like `npm run dev -- --port=${portNumber}`. These are easily identifiable by the fact that they
have a package.json.

### Docker Resources

If the application has a docker-compose.yml we could assume that it has resources where Docker is needed to run them and
that could be done by running the command `docker compose up -d` in the root directory

# Requirements

## Servers Page

I need a page added to the workboard dev app that is called "servers"

### Server Crud

- This page will have the ability to add servers
- The dropdown will take you to the explorer directory finder and let you pick a directory
- The app will be auto-detected as one of the server types, but there will also be a dropdown to choose
  the type as things may change within an app
- Servers will also have an option Port field
- Docker Command will also be optional as this may change but will be auto-detected when added
- You can remove a server and will run the stop command, verify it's stopped and then delete the record
- Server records will be stored in the local.db file

#### Fields

Alias: name is derived by folder by is overwritable
Server Type: Python | Svelte (NPM)
Docker: boolean

### Launcher

Once servers have been added they will added to the launcher area. The launcher area will have the following:
**App Name**: This will be derived from the parent folder name, but can be replaced in the CRUD with an alias
**Status**: Current status of the server, A list of the server, and docker and if they're running or not. This is polled
every five minutes if the page is open or when the page receives focus and doesn't poll when the page is not open
**Refresh Button**: This will poll immediately for the status of the server
**Start/Stop Button**: This will launch the app with its relevant command and resources. And stop it by tracking the PIDs
that are used to launch the apps and kill those or by running if `docker compose down` if applicable and will update the
status of the application
**Restart Button**: This will stop the application, update the status, then start the application and update the status.
**Link**: There will be an upward-right arrow that open the server in a new page.
**Edit Button**: This will allow all of the settings on a managed server to be changes
