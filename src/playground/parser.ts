/**
 * The playground's little expression language: Desmos-flavoured math over
 * scalars and 2D vectors.
 *
 *   v(3, 2)                 a vector
 *   (3, 2)                  the same thing — parens with a comma build a vector
 *   a = v(cos(pi/8), sin(pi/8))
 *   2a + b                  juxtaposition after a number means multiply
 *
 * This file only turns source text into an AST. Meaning — what `v` and `+`
 * actually do, and how rows see each other's names — lives in evaluate.ts.
 */

export type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'ref'; name: string }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'unary'; op: '-'; operand: Expr }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: Expr; right: Expr }

export interface Statement {
  /** Set when the row is a definition (`a = …`); null for a bare expression. */
  name: string | null
  expr: Expr
}

export class ParseError extends Error {
  override readonly name = 'ParseError'
}

/* ------------------------------ tokenizer ------------------------------ */

type Token =
  | { type: 'num'; value: number }
  | { type: 'name'; value: string }
  | { type: 'punct'; value: string }

const PUNCT = new Set(['(', ')', ',', '+', '-', '*', '/', '^', '='])

function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
    } else if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(src.slice(i))
      if (!m) throw new ParseError(`I can't read the number at "${src.slice(i, i + 6)}"`)
      tokens.push({ type: 'num', value: Number(m[0]) })
      i += m[0].length
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!
      tokens.push({ type: 'name', value: m[0] })
      i += m[0].length
    } else if (PUNCT.has(c)) {
      tokens.push({ type: 'punct', value: c })
      i++
    } else {
      throw new ParseError(`"${c}" isn't something I understand`)
    }
  }
  return tokens
}

/* ------------------------------- parser -------------------------------- */

class Parser {
  private at = 0

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.at]
  }

  private isPunct(value: string, ahead = 0): boolean {
    const t = this.tokens[this.at + ahead]
    return t?.type === 'punct' && t.value === value
  }

  private eat(value: string): boolean {
    if (!this.isPunct(value)) return false
    this.at++
    return true
  }

  private expect(value: string): void {
    if (!this.eat(value)) throw new ParseError(`I expected "${value}" here`)
  }

  statement(): Statement {
    let name: string | null = null
    const first = this.peek()
    if (first?.type === 'name' && this.isPunct('=', 1)) {
      name = first.value
      this.at += 2
    }
    const expr = this.expression()
    if (this.at < this.tokens.length) {
      throw new ParseError(`I got stuck at the end — there's an extra piece after the expression`)
    }
    return { name, expr }
  }

  private expression(): Expr {
    let left = this.term()
    while (this.isPunct('+') || this.isPunct('-')) {
      const op = (this.tokens[this.at] as { value: string }).value as '+' | '-'
      this.at++
      left = { kind: 'binary', op, left, right: this.term() }
    }
    return left
  }

  private term(): Expr {
    let left = this.unary()
    while (this.isPunct('*') || this.isPunct('/')) {
      const op = (this.tokens[this.at] as { value: string }).value as '*' | '/'
      this.at++
      left = { kind: 'binary', op, left, right: this.unary() }
    }
    return left
  }

  private unary(): Expr {
    if (this.eat('-')) return { kind: 'unary', op: '-', operand: this.unary() }
    return this.power()
  }

  /**
   * `^` binds tighter than unary minus (so -2^2 is -4) and is right
   * associative (2^3^2 is 2^9). Its exponent parses as a unary, which is what
   * lets you write 2^-1.
   */
  private power(): Expr {
    const base = this.primary()
    if (!this.eat('^')) return base
    return { kind: 'binary', op: '^', left: base, right: this.unary() }
  }

  private primary(): Expr {
    const t = this.peek()
    if (!t) throw new ParseError('The expression stops early — something is missing')

    if (t.type === 'num') {
      this.at++
      const num: Expr = { kind: 'num', value: t.value }
      // Juxtaposition, but only after a literal: `2pi` and `3(x+1)` multiply,
      // while `v(1,2)(3)` stays an error rather than a silent product.
      const next = this.peek()
      if (next?.type === 'name' || this.isPunct('(')) {
        return { kind: 'binary', op: '*', left: num, right: this.power() }
      }
      return num
    }

    if (t.type === 'name') {
      this.at++
      if (!this.eat('(')) return { kind: 'ref', name: t.value }
      const args: Expr[] = []
      if (!this.isPunct(')')) {
        do args.push(this.expression())
        while (this.eat(','))
      }
      this.expect(')')
      return { kind: 'call', name: t.value, args }
    }

    if (this.eat('(')) {
      const first = this.expression()
      if (this.eat(',')) {
        const second = this.expression()
        this.expect(')')
        return { kind: 'call', name: 'v', args: [first, second] }
      }
      this.expect(')')
      return first
    }

    throw new ParseError(`I didn't expect "${t.value}" here`)
  }
}

export function parse(source: string): Statement {
  const tokens = tokenize(source)
  if (!tokens.length) throw new ParseError('Empty expression')
  return new Parser(tokens).statement()
}
