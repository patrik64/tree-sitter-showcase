export interface QueryPreset {
	name: string;
	query: string;
}

export interface LanguageConfig {
	id: string;
	label: string;
	sample: string;
	highlightQuery: string;
	queryPresets: QueryPreset[];
}

const jsHighlight = `(comment) @comment
(string) @string
(template_string) @string
(regex) @string
(number) @number
[(true) (false) (null) (undefined)] @constant
(function_declaration name: (identifier) @function)
(method_definition name: (property_identifier) @function)
(call_expression function: (identifier) @function)
(call_expression
  function: (member_expression property: (property_identifier) @function))
(property_identifier) @property
(identifier) @variable
["if" "else" "for" "while" "return" "function" "const" "let" "var"
 "class" "extends" "new" "import" "from" "export" "default"
 "async" "await" "of" "in" "try" "catch" "throw" "yield"] @keyword`;

const rustHighlight = `(line_comment) @comment
(block_comment) @comment
(string_literal) @string
(char_literal) @string
(integer_literal) @number
(float_literal) @number
(boolean_literal) @constant
(function_item name: (identifier) @function)
(call_expression function: (identifier) @function)
(call_expression
  function: (field_expression field: (field_identifier) @function))
(call_expression
  function: (scoped_identifier name: (identifier) @function))
(macro_invocation macro: (identifier) @function)
(type_identifier) @type
(primitive_type) @type
(field_identifier) @property
(self) @keyword
(mutable_specifier) @keyword
(identifier) @variable
["fn" "let" "pub" "struct" "enum" "impl" "trait" "for" "in"
 "if" "else" "match" "return" "use" "mod" "while" "loop" "where"
 "unsafe" "async" "await" "move" "dyn" "const" "static" "ref"] @keyword`;

const pythonHighlight = `(comment) @comment
(string) @string
(integer) @number
(float) @number
[(true) (false) (none)] @constant
(function_definition name: (identifier) @function)
(class_definition name: (identifier) @type)
(call function: (identifier) @function)
(call function: (attribute attribute: (identifier) @function))
(attribute attribute: (identifier) @property)
(identifier) @variable
["def" "class" "return" "if" "elif" "else" "for" "while" "import"
 "from" "as" "with" "try" "except" "finally" "lambda" "pass"
 "break" "continue" "in" "not" "and" "or" "is" "raise" "yield"
 "global" "async" "await"] @keyword`;

const jsonHighlight = `(pair key: (string) @property)
(string) @string
(number) @number
[(true) (false) (null)] @constant`;

export const LANGUAGES: LanguageConfig[] = [
	{
		id: 'javascript',
		label: 'JavaScript',
		sample: `// Fibonacci with memoization
const MAX_ENTRIES = 1000;
const cache = new Map();

function fib(n) {
  if (n <= 1) return n;
  if (cache.has(n)) return cache.get(n);
  const result = fib(n - 1) + fib(n - 2);
  cache.set(n, result);
  return result;
}

class Sequence {
  constructor(limit) {
    this.limit = limit;
  }

  *values() {
    for (let i = 0; i < this.limit; i++) {
      yield fib(i);
    }
  }
}

const seq = new Sequence(10);
console.log([...seq.values()]);
`,
		highlightQuery: jsHighlight,
		queryPresets: [
			{
				name: 'Functions & calls',
				query: `; Every declared function, with its name captured separately
(function_declaration
  name: (identifier) @fn.name) @fn.def

; Every direct call
(call_expression
  function: (identifier) @call.name)`
			},
			{
				name: 'Method calls on objects',
				query: `(call_expression
  function: (member_expression
    object: (identifier) @receiver
    property: (property_identifier) @method))`
			},
			{
				name: 'Predicates: SCREAMING_CASE',
				query: `; Predicates filter matches beyond pure structure
((identifier) @constant
  (#match? @constant "^[A-Z][A-Z_]+$"))`
			},
			{ name: 'Full highlight query', query: jsHighlight }
		]
	},
	{
		id: 'rust',
		label: 'Rust',
		sample: `use std::collections::HashMap;

#[derive(Debug, Clone)]
struct Node {
    kind: String,
    children: Vec<Node>,
}

impl Node {
    fn new(kind: &str) -> Self {
        Node {
            kind: kind.to_string(),
            children: Vec::new(),
        }
    }

    fn count(&self) -> usize {
        1 + self.children.iter().map(Node::count).sum::<usize>()
    }
}

fn main() {
    let mut counts: HashMap<String, usize> = HashMap::new();
    let tree = Node::new("source_file");
    counts.insert(tree.kind.clone(), tree.count());
    println!("{:?}", counts);
}
`,
		highlightQuery: rustHighlight,
		queryPresets: [
			{
				name: 'Functions & impls',
				query: `(function_item name: (identifier) @fn.name)

(impl_item type: (type_identifier) @impl.type)`
			},
			{
				name: 'Struct fields',
				query: `(field_declaration
  name: (field_identifier) @field.name
  type: (_) @field.type)`
			},
			{
				name: 'Macro invocations',
				query: `(macro_invocation
  macro: (identifier) @macro.name)`
			},
			{ name: 'Full highlight query', query: rustHighlight }
		]
	},
	{
		id: 'python',
		label: 'Python',
		sample: `from dataclasses import dataclass, field

@dataclass
class TreeNode:
    kind: str
    children: list["TreeNode"] = field(default_factory=list)

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

def count_kinds(root):
    counts = {}
    for node in root.walk():
        counts[node.kind] = counts.get(node.kind, 0) + 1
    return counts

root = TreeNode("module", [TreeNode("function"), TreeNode("class")])
print(count_kinds(root))
`,
		highlightQuery: pythonHighlight,
		queryPresets: [
			{
				name: 'Functions & classes',
				query: `(function_definition name: (identifier) @fn.name)

(class_definition name: (identifier) @class.name)`
			},
			{
				name: 'Decorated definitions',
				query: `(decorated_definition
  (decorator) @decorator
  definition: (_) @decorated)`
			},
			{ name: 'Full highlight query', query: pythonHighlight }
		]
	},
	{
		id: 'json',
		label: 'JSON',
		sample: `{
  "name": "tree-sitter-demo",
  "version": "1.0.0",
  "private": true,
  "keywords": ["parsing", "incremental", "wasm"],
  "engines": {
    "node": ">=20"
  },
  "counts": [1, 2, 3, null]
}
`,
		highlightQuery: jsonHighlight,
		queryPresets: [
			{
				name: 'Keys & values',
				query: `(pair
  key: (string) @key
  value: (_) @value)`
			},
			{ name: 'Full highlight query', query: jsonHighlight }
		]
	}
];

export function languageById(id: string): LanguageConfig {
	return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}
