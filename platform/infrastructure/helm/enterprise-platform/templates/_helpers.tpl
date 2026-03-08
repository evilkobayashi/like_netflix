{{- define "enterprise-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "enterprise-platform.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "enterprise-platform.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
