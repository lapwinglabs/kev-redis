DBPATH := test/db/redis

test: $(DBPATH) install-redis
		@LOG=test* ./node_modules/.bin/prok \
		--env test/env.test \
		--procfile test/Procfile.test \
		--root .

node_modules_test: package.json
	@npm install --dev
	@touch node_modules

$(DBPATH):
	@mkdir -p $@

install-redis:
ifeq (,$(shell which redis-server))
	@echo installing redis...
	@brew install redis
else
endif

.PHONY: test
