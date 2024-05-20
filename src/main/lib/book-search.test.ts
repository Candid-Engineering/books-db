// sum.test.js
import { expect, test } from 'vitest'
import { findByIsbn } from './book-search'

test('finding a book by ISBN works', async () => {
  expect(await findByIsbn(9780316551670)).toMatchObject({
    authors: ['Kerri Maniscalco'],
    categories: ['Young Adult Fiction'],
    description:
      "In this New York Times bestselling thriller, bizarre murders are discovered in the castle of Prince Vlad the Impaler, otherwise known as Dracula. Could it be a copycat killer...or has the depraved prince been brought back to life? FEATURES BONUS CONTENT EXCLUSIVE TO THIS PAPERBACK EDITION! Following the grief and horror of her discovery of Jack the Ripper's true identity, Audrey Rose Wadsworth has no choice but to flee London and its memories. Together with the arrogant yet charming Thomas Cresswell, she journeys to the dark heart of Romania, home to one of Europe's best schools of forensic medicine...and to another notorious killer, Vlad the Impaler, whose thirst for blood became legend. But her life's dream is soon tainted by blood-soaked discoveries in the halls of the school's forbidding castle, and Audrey Rose is compelled to investigate the strangely familiar murders. What she finds brings all her terrifying fears to life once again. EXCLUSIVE TO THIS EDITION: Bonus letters between characters, revealing intimate content never previously available!",
    isbn: '9780316551670',
    pageCount: 0, // Should import from another source??
    title: 'Hunting Prince Dracula'
  })
})
