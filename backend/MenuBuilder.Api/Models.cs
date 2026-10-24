namespace MenuBuilder.Api;

public record MenuItem(string Id, string Name, Guid? ImageId);
public record Section(string Id, string Title, int? Step, List<MenuItem> Items, string? Layout = null);
public record MenuTheme(string Background, string Panel, string Accent, string Text);
public record Menu(string Id, string Brand, string Title, string Subtitle, string Footer, List<Section> Sections,
	MenuTheme? Theme = null, int Columns = 3);
public record MenuSummary(string Id, string Title);
public record StoredImage(string ContentType, byte[] Data);
public record LibraryItem(string Id, string Name, Guid? ImageId);
public record SaveLibraryItemRequest(string Name, Guid? ImageId);
public record MenuTemplateSection(string Title, int? Step, string Layout);
public record MenuTemplate(string Id, string Name, string Brand, string Title, string Subtitle, string Footer,
	MenuTheme Theme, int Columns, List<MenuTemplateSection> Sections);
public record MenuTemplateSummary(string Id, string Name);
public record SaveTemplateRequest(string Name);
public record AddSectionRequest(string Title, string Layout);
