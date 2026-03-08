# Deployment Notes

## Kubernetes Base Manifests
- Base manifests are in `platform/infrastructure/k8s/base`.
- They include namespace, config/secret templates, init job, platform service deployments/services, and supporting infrastructure workloads.
- Apply with:
  - `kubectl apply -k platform/infrastructure/k8s/base`

## Helm
- Helm chart path: `platform/infrastructure/helm/enterprise-platform`.
- It deploys every platform service (`api-gateway`, identity/user/authz/workflow/approval/automation/notification/dashboard/audit/integration/worker, `web`, `nginx`) plus data/observability services.
- Install with:
  - `helm upgrade --install enterprise-platform platform/infrastructure/helm/enterprise-platform --namespace enterprise-platform --create-namespace`

## Argo CD
- Argo CD manifests are in `platform/infrastructure/argocd`:
  - `project.yaml`
  - `application.yaml`
- `application.yaml` includes:
  - Helm-based `enterprise-platform` app
  - K8s base `enterprise-platform-k8s-base` app
- Apply with:
  - `kubectl apply -n argocd -f platform/infrastructure/argocd/project.yaml`
  - `kubectl apply -n argocd -f platform/infrastructure/argocd/application.yaml`
