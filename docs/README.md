These docs are built with Jekyll using the [Just the Docs theme](https://just-the-docs.com/).

They are served on GitHub Pages at [https://derbyjs.github.io/derby/](https://derbyjs.github.io/derby/).

# Locally building and viewing docs

Jekyll has a dev server, which will auto-build the docs upon any changes to the docs' source files. Only changes to `_config.yml` require a dev server restart.

## With local Ruby

Setup:

```
cd docs && bundle install
```

Run the dev server:

```
bundle exec jekyll serve
```

The site is viewable at `http://localhost:4000/derby/`.

## With Ruby in Docker container

One-time container creation:

```
docker run --name derby-docs-ruby -v "$(pwd)/docs:/docs" -p 127.0.0.1:4000:4000 ruby:2.7 bash -c 'cd docs && bundle install && bundle exec jekyll serve -H 0.0.0.0 -P 4000 --trace'
```

Subsequently, to run the dev server:

```
docker start -i derby-docs-ruby
```

Either way, the site is viewable at `http://localhost:4000/derby/`.

Explanation of flags:
* `-v` - Set up a Docker bind mount, mapping the host's `$PWD/docs` directory to a container directory `/derby-docs`.
* `-p` - Map the host's local port 4000 to the container's port 4000, to allow the dev server inside the container to serve requests issued against the host.
* `-H 0.0.0.0 -P 4000` - Have the dev server listen to connections from outside the container. This won't allow connections from outside the host.

To recreate the container with a different command or setup, run `docker rm derby-docs-ruby` to delete the container first.
