import { Either } from "fp-ts/lib/Either"

export function unwrapOrThrow<A, B>(a: Either<A, B>) {
  if (a._tag == "Right") {
    return a.right
  } else {
    throw new Error(`unexpected left: ${JSON.stringify(a.left)}`)
  }
}
