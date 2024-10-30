describe('Hello Tauri', () => {
  it('should be cordial', async () => {
    const header = $('h1')
    const text = await header.getText()
    await expect(text).toMatch(/^Your Friendly Book Catalog/)
  })
})
