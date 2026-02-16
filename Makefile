.PHONY: install build test lint format docker-build pre-commit clean release-patch release-minor release-major

install:
	npm ci

build:
	npm run build

test:
	npm test

lint:
	npm run lint

format:
	npm run format

docker-build:
	docker build -t minimize-resolved-pr-reviews .

pre-commit: format lint test

clean:
	rm -rf dist/

release-patch:
	npm version patch
	git push && git push --tags

release-minor:
	npm version minor
	git push && git push --tags

release-major:
	npm version major
	git push && git push --tags
