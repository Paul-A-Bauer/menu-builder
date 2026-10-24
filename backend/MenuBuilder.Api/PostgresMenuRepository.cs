using System.Text.Json;
using Dapper;
using Npgsql;

namespace MenuBuilder.Api;

// Menus are stored as one JSON document each, so the schema never needs to change
// when the menu layout evolves, and any document/relational store can mimic it.
public class PostgresMenuRepository(string connectionString) : IMenuRepository
{
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    NpgsqlConnection Open() => new(connectionString);

    public async Task InitAsync()
    {
        await using var c = Open();
        await c.ExecuteAsync("""
            CREATE TABLE IF NOT EXISTS menus (
                id text PRIMARY KEY,
                title text NOT NULL,
                data jsonb NOT NULL,
                updated_at timestamptz NOT NULL DEFAULT now());
            CREATE TABLE IF NOT EXISTS images (
                id uuid PRIMARY KEY,
                content_type text NOT NULL,
                data bytea NOT NULL);
            CREATE TABLE IF NOT EXISTS library_items (
                id text PRIMARY KEY,
                name text NOT NULL,
                image_id uuid NULL,
                created_at timestamptz NOT NULL DEFAULT now());
            CREATE TABLE IF NOT EXISTS menu_templates (
                id text PRIMARY KEY,
                name text NOT NULL,
                data jsonb NOT NULL,
                updated_at timestamptz NOT NULL DEFAULT now());
                        INSERT INTO library_items (id, name, image_id)
                        SELECT gen_random_uuid()::text, item->>'name',
                                     CASE WHEN item->>'imageId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                                THEN (item->>'imageId')::uuid ELSE NULL END
                        FROM menus
                        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(data->'sections', '[]'::jsonb)) section
                        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(section->'items', '[]'::jsonb)) item
                        WHERE length(trim(COALESCE(item->>'name', ''))) > 0
                            AND NOT EXISTS (
                                    SELECT 1 FROM library_items existing
                                    WHERE existing.name = trim(item->>'name')
                                        AND existing.image_id IS NOT DISTINCT FROM
                                                CASE WHEN item->>'imageId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                                                         THEN (item->>'imageId')::uuid ELSE NULL END);
            """);
    }

    public async Task<IReadOnlyList<MenuSummary>> ListAsync()
    {
        await using var c = Open();
        var rows = await c.QueryAsync<MenuSummary>("SELECT id AS Id, title AS Title FROM menus ORDER BY updated_at DESC");
        return rows.ToList();
    }

    public async Task<Menu?> GetAsync(string id)
    {
        await using var c = Open();
        var json = await c.QuerySingleOrDefaultAsync<string>("SELECT data::text FROM menus WHERE id = @id", new { id });
        return json is null ? null : NormalizeLayouts(JsonSerializer.Deserialize<Menu>(json, Json)!);
    }

    public async Task SaveAsync(Menu menu)
    {
        menu = NormalizeLayouts(menu);
        await using var c = Open();
        await c.ExecuteAsync("""
            INSERT INTO menus (id, title, data) VALUES (@id, @title, @data::jsonb)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, data = EXCLUDED.data, updated_at = now()
            """,
            new { id = menu.Id, title = $"{menu.Brand} {menu.Title}".Trim(), data = JsonSerializer.Serialize(menu, Json) });
    }

    public async Task<bool> DeleteAsync(string id)
    {
        await using var c = Open();
        return await c.ExecuteAsync("DELETE FROM menus WHERE id = @id", new { id }) > 0;
    }

    public async Task<Guid> SaveImageAsync(string contentType, byte[] data)
    {
        var id = Guid.NewGuid();
        await using var c = Open();
        await c.ExecuteAsync("INSERT INTO images (id, content_type, data) VALUES (@id, @contentType, @data)",
            new { id, contentType, data });
        return id;
    }

    public async Task<StoredImage?> GetImageAsync(Guid id)
    {
        await using var c = Open();
        return await c.QuerySingleOrDefaultAsync<StoredImage>(
            "SELECT content_type AS ContentType, data AS Data FROM images WHERE id = @id", new { id });
    }

    public async Task<IReadOnlyList<LibraryItem>> ListLibraryItemsAsync()
    {
        await using var c = Open();
        var rows = await c.QueryAsync<LibraryItem>(
            "SELECT id AS Id, name AS Name, image_id AS ImageId FROM library_items ORDER BY name");
        return rows.ToList();
    }

    public async Task<LibraryItem?> GetLibraryItemAsync(string id)
    {
        await using var c = Open();
        return await c.QuerySingleOrDefaultAsync<LibraryItem>(
            "SELECT id AS Id, name AS Name, image_id AS ImageId FROM library_items WHERE id = @id", new { id });
    }

    public async Task<LibraryItem> SaveLibraryItemAsync(string name, Guid? imageId)
    {
        var item = new LibraryItem(Guid.NewGuid().ToString(), name, imageId);
        await using var c = Open();
        await c.ExecuteAsync(
            "INSERT INTO library_items (id, name, image_id) VALUES (@Id, @Name, @ImageId)", item);
        return item;
    }

    public async Task<IReadOnlyList<MenuTemplateSummary>> ListTemplatesAsync()
    {
        await using var c = Open();
        var rows = await c.QueryAsync<MenuTemplateSummary>(
            "SELECT id AS Id, name AS Name FROM menu_templates ORDER BY updated_at DESC");
        return rows.ToList();
    }

    public async Task<MenuTemplate?> GetTemplateAsync(string id)
    {
        await using var c = Open();
        var json = await c.QuerySingleOrDefaultAsync<string>(
            "SELECT data::text FROM menu_templates WHERE id = @id", new { id });
        return json is null ? null : JsonSerializer.Deserialize<MenuTemplate>(json, Json);
    }

    public async Task<MenuTemplate> SaveTemplateAsync(MenuTemplate template)
    {
        await using var c = Open();
        await c.ExecuteAsync("""
            INSERT INTO menu_templates (id, name, data) VALUES (@id, @name, @data::jsonb)
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = now()
            """,
            new { id = template.Id, name = template.Name, data = JsonSerializer.Serialize(template, Json) });
        return template;
    }

    public async Task<bool> DeleteTemplateAsync(string id)
    {
        await using var c = Open();
        return await c.ExecuteAsync("DELETE FROM menu_templates WHERE id = @id", new { id }) > 0;
    }

    private static Menu NormalizeLayouts(Menu menu) => menu with
    {
        Sections = menu.Sections.Select(section => section with
        {
            Layout = section.Layout ?? (section.Id is "main" or "side" ? "row" : "grid"),
            ColumnSpan = section.ColumnSpan ?? (section.Id == "main" ? menu.Columns : 1),
        }).ToList(),
    };
}
