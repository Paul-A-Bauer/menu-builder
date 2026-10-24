namespace MenuBuilder.Api;

public sealed class MenuService(IMenuRepository repository)
{
    private static readonly MenuTheme DefaultTheme = new("#bfe1f1", "#ffffff", "#d8212f", "#1f2933");

    public async Task<Menu> CreateAsync(string? templateId = null)
    {
        Menu menu;
        if (templateId is not null)
        {
            var template = await repository.GetTemplateAsync(templateId)
                ?? throw new KeyNotFoundException("Template not found.");
            menu = new Menu(Guid.NewGuid().ToString(), template.Brand, template.Title, template.Subtitle,
                template.Footer, template.Sections.Select(section => new Section(
                        Guid.NewGuid().ToString(), section.Title, section.Step, [NewItem()], NormalizeLayout(section.Layout))).ToList(),
                template.Theme, template.Columns);
        }
        else
        {
            menu = new Menu(
                Guid.NewGuid().ToString(),
                "My Diner",
                "Kids' Menu!",
                "12 & Under",
                "Make your pick! Ask your server about allergies.",
                [
                    new Section("main", "CHOOSE YOUR\nMAIN", 1, [NewItem(), NewItem()], "row"),
                    new Section("side", "CHOOSE ONE\nSIDE", 2, [NewItem(), NewItem()], "row"),
                    new Section("drink", "ADD A DRINK", null, [NewItem()]),
                    new Section("treat", "ADD A SWEET TREAT", null, [NewItem()]),
                ], DefaultTheme);
        }

        await repository.SaveAsync(menu);
        return menu;
    }

    public async Task<Menu?> AddItemAsync(string menuId, string sectionId, string? libraryItemId = null)
    {
        var menu = await repository.GetAsync(menuId);
        if (menu is null || !menu.Sections.Any(section => section.Id == sectionId)) return null;
        var libraryItem = libraryItemId is null ? null : await repository.GetLibraryItemAsync(libraryItemId);
        if (libraryItemId is not null && libraryItem is null) return null;
        var newItem = libraryItem is null
            ? NewItem()
            : new MenuItem(Guid.NewGuid().ToString(), libraryItem.Name, libraryItem.ImageId);

        var updated = menu with
        {
            Sections = menu.Sections.Select(section => section.Id == sectionId
                ? section with { Items = [.. section.Items, newItem] }
                : section).ToList(),
        };

        await repository.SaveAsync(updated);
        return updated;
    }

    public async Task<LibraryItem> CreateLibraryItemAsync(SaveLibraryItemRequest request)
    {
        var name = request.Name.Trim();
        if (name.Length is < 1 or > 120) throw new ArgumentException("Item title must be 1 to 120 characters.");
        if (request.ImageId is { } imageId && await repository.GetImageAsync(imageId) is null)
            throw new ArgumentException("The selected image does not exist.");
        return await repository.SaveLibraryItemAsync(name, request.ImageId);
    }

    public Task<IReadOnlyList<LibraryItem>> ListLibraryItemsAsync() => repository.ListLibraryItemsAsync();

    public async Task<Menu?> AddSectionAsync(string menuId, AddSectionRequest request)
    {
        var menu = await repository.GetAsync(menuId);
        var title = request.Title.Trim();
        if (menu is null || title.Length is < 1 or > 80) return null;
        var layout = NormalizeLayout(request.Layout);
        var updated = menu with
        {
            Sections = [.. menu.Sections, new Section(Guid.NewGuid().ToString(), title, null, [NewItem()], layout)],
        };
        await repository.SaveAsync(updated);
        return updated;
    }

    public async Task<Menu?> RemoveSectionAsync(string menuId, string sectionId)
    {
        var menu = await repository.GetAsync(menuId);
        if (menu is null || menu.Sections.Count <= 1 || menu.Sections.All(section => section.Id != sectionId)) return null;
        var updated = menu with { Sections = menu.Sections.Where(section => section.Id != sectionId).ToList() };
        await repository.SaveAsync(updated);
        return updated;
    }

    public async Task<IReadOnlyList<MenuTemplateSummary>> ListTemplatesAsync() => await repository.ListTemplatesAsync();

    public async Task<MenuTemplate> SaveTemplateAsync(string menuId, SaveTemplateRequest request)
    {
        var menu = await repository.GetAsync(menuId) ?? throw new KeyNotFoundException("Menu not found.");
        var name = request.Name.Trim();
        if (name.Length is < 1 or > 80) throw new ArgumentException("Template name must be 1 to 80 characters.");
        var template = new MenuTemplate(Guid.NewGuid().ToString(), name, menu.Brand, menu.Title, menu.Subtitle,
            menu.Footer, menu.Theme ?? DefaultTheme, Math.Clamp(menu.Columns, 1, 6), menu.Sections.Select(section =>
                new MenuTemplateSection(section.Title, section.Step, NormalizeLayout(section.Layout, section.Id))).ToList());
        return await repository.SaveTemplateAsync(template);
    }

    public Task<MenuTemplate?> GetTemplateAsync(string id) => repository.GetTemplateAsync(id);

    public Task<bool> DeleteTemplateAsync(string id) => repository.DeleteTemplateAsync(id);

    public async Task<Menu?> RemoveItemAsync(string menuId, string sectionId, string itemId)
    {
        var menu = await repository.GetAsync(menuId);
        var section = menu?.Sections.FirstOrDefault(section => section.Id == sectionId);
        if (menu is null || section is null || !section.Items.Any(item => item.Id == itemId)) return null;

        var updated = menu with
        {
            Sections = menu.Sections.Select(current => current.Id == sectionId
                ? current with { Items = current.Items.Where(item => item.Id != itemId).ToList() }
                : current).ToList(),
        };

        await repository.SaveAsync(updated);
        return updated;
    }

    public async Task UpdateMenuAsync(string id, Menu menu)
    {
        if (await repository.GetAsync(id) is null) throw new KeyNotFoundException("Menu not found.");
        if (menu.Sections.Count < 1) throw new ArgumentException("A menu must have at least one area.");
        if (menu.Columns is < 1 or > 6) throw new ArgumentException("Areas per row must be between 1 and 6.");
        if (menu.Brand.Length > 100 || menu.Title.Length > 120 || menu.Subtitle.Length > 120 || menu.Footer.Length > 240)
            throw new ArgumentException("Menu text exceeds the allowed length.");
        if (menu.Sections.Any(section => string.IsNullOrWhiteSpace(section.Title) || section.Title.Length > 80))
            throw new ArgumentException("Area titles must be 1 to 80 characters.");
        if (menu.Sections.Select(section => section.Id).Distinct().Count() != menu.Sections.Count)
            throw new ArgumentException("Area IDs must be unique.");
        if (menu.Sections.SelectMany(section => section.Items).Any(item => item.Name.Length > 120))
            throw new ArgumentException("Item titles must be 120 characters or fewer.");
        if (menu.Sections.SelectMany(section => section.Items).Select(item => item.Id).Distinct().Count() !=
            menu.Sections.Sum(section => section.Items.Count))
            throw new ArgumentException("Item IDs must be unique.");

        var theme = menu.Theme ?? DefaultTheme;
        if (!IsHexColor(theme.Background) || !IsHexColor(theme.Panel) || !IsHexColor(theme.Accent) || !IsHexColor(theme.Text))
            throw new ArgumentException("Theme colors must be six-digit hexadecimal colors.");
        if (menu.Sections.Any(section => section.Layout is not (null or "grid" or "row")))
            throw new ArgumentException("Area layout must be grid or row.");

        await repository.SaveAsync(menu with
        {
            Id = id,
            Theme = theme,
            Sections = menu.Sections.Select(section => section with
            {
                Layout = NormalizeLayout(section.Layout, section.Id),
            }).ToList(),
        });
    }

    private static MenuItem NewItem() => new(Guid.NewGuid().ToString(), "", null);

    private static string NormalizeLayout(string? layout, string? sectionId = null) => layout switch
    {
        "row" => "row",
        "grid" => "grid",
        _ => sectionId is "main" or "side" ? "row" : "grid",
    };

    private static bool IsHexColor(string value) =>
        value.Length == 7 && value[0] == '#' && value.AsSpan(1).ToArray().All(Uri.IsHexDigit);
}