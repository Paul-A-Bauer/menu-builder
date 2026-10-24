# ---- 1. build the React app (Vite writes into backend/MenuBuilder.Api/wwwroot) ----
FROM node:20-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. publish the .NET API ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api
WORKDIR /src
COPY backend/MenuBuilder.Api/MenuBuilder.Api.csproj backend/MenuBuilder.Api/
RUN dotnet restore backend/MenuBuilder.Api
COPY backend/ backend/
COPY --from=web /src/backend/MenuBuilder.Api/wwwroot backend/MenuBuilder.Api/wwwroot
RUN dotnet publish backend/MenuBuilder.Api -c Release -o /out --no-restore

# ---- 3. slim runtime image ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=api /out ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "MenuBuilder.Api.dll"]
