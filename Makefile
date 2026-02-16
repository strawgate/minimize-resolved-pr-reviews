.PHONY: install build test lint format docker-build pre-commit clean

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
