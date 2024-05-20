import IsbnAPI from '@library-pals/isbn'

export async function findByIsbn(isbn: number): Promise<unknown> {
  const isbnAPI = new IsbnAPI()
  isbnAPI.provider([isbnAPI.PROVIDER_NAMES.GOOGLE])
  const book = await isbnAPI.resolve(isbn.toString())
  console.log('book:', book)
  return book
}
