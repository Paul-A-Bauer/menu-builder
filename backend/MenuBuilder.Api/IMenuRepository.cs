namespace MenuBuilder.Api;

public interface IMenuRepository
{
    Task InitAsync();
    Task<IReadOnlyList<MenuSummary>> ListAsync();
    Task<Menu?> GetAsync(string id);
    Task SaveAsync(Menu menu);              // insert or update
    Task<bool> DeleteAsync(string id);
    Task<Guid> SaveImageAsync(string contentType, byte[] data);
    Task<StoredImage?> GetImageAsync(Guid id);
    Task<IReadOnlyList<LibraryItem>> ListLibraryItemsAsync();
    Task<LibraryItem?> GetLibraryItemAsync(string id);
    Task<LibraryItem> SaveLibraryItemAsync(string name, Guid? imageId);
    Task<IReadOnlyList<MenuTemplateSummary>> ListTemplatesAsync();
    Task<MenuTemplate?> GetTemplateAsync(string id);
    Task<MenuTemplate> SaveTemplateAsync(MenuTemplate template);
    Task<bool> DeleteTemplateAsync(string id);
}
