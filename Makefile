# Makefile — docs-hub-web
# Chỉ gói các thao tác deploy trên EC2; công việc thường ngày vẫn dùng npm.

EC2_COMPOSE := deployments/ec2/docker-compose.yml
EC2_ENV     := .env.ec2

.DEFAULT_GOAL := help

.PHONY: help
help: ## Hiển thị danh sách lệnh
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: ec2-up
ec2-up: ## Build + chạy web trên EC2
	@test -f $(EC2_ENV) || (echo "❌ Thiếu $(EC2_ENV) — cp .env.ec2.example $(EC2_ENV) rồi điền"; exit 1)
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) up -d --build

.PHONY: ec2-down
ec2-down: ## Tắt web trên EC2
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) down

.PHONY: ec2-logs
ec2-logs: ## Xem log web
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) logs -f web

.PHONY: ec2-ps
ec2-ps: ## Trạng thái web
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) ps

.PHONY: ec2-restart
ec2-restart: ## Build lại web sau khi cập nhật code
	docker compose -f $(EC2_COMPOSE) --env-file $(EC2_ENV) up -d --build web
