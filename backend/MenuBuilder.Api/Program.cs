using MenuBuilder.Api;
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args);

// Swap databases here: register a different IMenuRepository implementation.
builder.Services.AddSingleton<IMenuRepository>(
    new PostgresMenuRepository(builder.Configuration.GetConnectionString("Default")!));
builder.Services.AddSingleton<MenuService>();
builder.Services.Configure<FormOptions>(o => o.MultipartBodyLengthLimit = 10_000_000);

var app = builder.Build();
await app.Services.GetRequiredService<IMenuRepository>().InitAsync();

app.UseDefaultFiles();
app.UseStaticFiles(); // serves the built React app from wwwroot in production

var api = app.MapGroup("/api");

api.MapGet("/menus", (IMenuRepository r) => r.ListAsync());

api.MapPost("/menus", async (MenuService service) =>
{
    var menu = await service.CreateAsync();
    return Results.Created($"/api/menus/{menu.Id}", menu);
});

api.MapPost("/menus/from-template/{templateId}", async (string templateId, MenuService service) =>
{
    try
    {
        var menu = await service.CreateAsync(templateId);
        return Results.Created($"/api/menus/{menu.Id}", menu);
    }
    catch (KeyNotFoundException e) { return Results.NotFound(e.Message); }
});

api.MapGet("/templates", (MenuService service) => service.ListTemplatesAsync());

api.MapPost("/menus/{id}/templates", async (string id, SaveTemplateRequest request, MenuService service) =>
{
    try { return Results.Created("/api/templates", await service.SaveTemplateAsync(id, request)); }
    catch (KeyNotFoundException e) { return Results.NotFound(e.Message); }
    catch (ArgumentException e) { return Results.BadRequest(e.Message); }
});

api.MapGet("/templates/{id}", async (string id, MenuService service) =>
    await service.GetTemplateAsync(id) is { } template ? Results.Ok(template) : Results.NotFound());

api.MapDelete("/templates/{id}", async (string id, MenuService service) =>
    await service.DeleteTemplateAsync(id) ? Results.NoContent() : Results.NotFound());

api.MapGet("/library/items", (MenuService service) => service.ListLibraryItemsAsync());

api.MapPost("/library/items", async (SaveLibraryItemRequest request, MenuService service) =>
{
    try { return Results.Created("/api/library/items", await service.CreateLibraryItemAsync(request)); }
    catch (ArgumentException e) { return Results.BadRequest(e.Message); }
});

api.MapGet("/menus/{id}", async (string id, IMenuRepository r) =>
    await r.GetAsync(id) is { } m ? Results.Ok(m) : Results.NotFound());

api.MapPost("/menus/{id}/sections/{sectionId}/items", async (string id, string sectionId, MenuService service) =>
    await service.AddItemAsync(id, sectionId) is { } menu ? Results.Ok(menu) : Results.NotFound());

api.MapPost("/menus/{id}/sections/{sectionId}/items/from-library/{libraryItemId}",
    async (string id, string sectionId, string libraryItemId, MenuService service) =>
        await service.AddItemAsync(id, sectionId, libraryItemId) is { } menu ? Results.Ok(menu) : Results.NotFound());

api.MapDelete("/menus/{id}/sections/{sectionId}/items/{itemId}", async (string id, string sectionId, string itemId, MenuService service) =>
    await service.RemoveItemAsync(id, sectionId, itemId) is { } menu ? Results.Ok(menu) : Results.NotFound());

api.MapPost("/menus/{id}/sections", async (string id, AddSectionRequest request, MenuService service) =>
    await service.AddSectionAsync(id, request) is { } menu ? Results.Ok(menu) : Results.BadRequest("Section title must be 1 to 80 characters.") );

api.MapDelete("/menus/{id}/sections/{sectionId}", async (string id, string sectionId, MenuService service) =>
    await service.RemoveSectionAsync(id, sectionId) is { } menu ? Results.Ok(menu) : Results.BadRequest("Menu must retain at least one section.") );

api.MapPut("/menus/{id}", async (string id, Menu menu, MenuService service) =>
{
    try
    {
        await service.UpdateMenuAsync(id, menu);
        return Results.NoContent();
    }
    catch (KeyNotFoundException e) { return Results.NotFound(e.Message); }
    catch (ArgumentException e) { return Results.BadRequest(e.Message); }
});

api.MapDelete("/menus/{id}", async (string id, IMenuRepository r) =>
    await r.DeleteAsync(id) ? Results.NoContent() : Results.NotFound());

api.MapPost("/images", async (IFormFile file, IMenuRepository r) =>
{
    if (!file.ContentType.StartsWith("image/")) return Results.BadRequest("Images only.");
    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);
    var id = await r.SaveImageAsync(file.ContentType, ms.ToArray());
    return Results.Ok(new { id });
}).DisableAntiforgery();

api.MapGet("/images/{id:guid}", async (Guid id, HttpContext ctx, IMenuRepository r) =>
{
    if (await r.GetImageAsync(id) is not { } img) return Results.NotFound();
    ctx.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    return Results.File(img.Data, img.ContentType);
});

app.MapFallbackToFile("index.html");
app.Run();
