const CONSTANTS = Object.freeze({
    pi: Math.PI,
    e: Math.E,
});

const FUNCTIONS = Object.freeze({
    abs: { call: Math.abs, minimum: 1, maximum: 1 },
    acos: { call: Math.acos, minimum: 1, maximum: 1 },
    asin: { call: Math.asin, minimum: 1, maximum: 1 },
    atan: { call: Math.atan, minimum: 1, maximum: 1 },
    atan2: { call: Math.atan2, minimum: 2, maximum: 2 },
    ceil: { call: Math.ceil, minimum: 1, maximum: 1 },
    cos: { call: Math.cos, minimum: 1, maximum: 1 },
    cosh: { call: Math.cosh, minimum: 1, maximum: 1 },
    exp: { call: Math.exp, minimum: 1, maximum: 1 },
    floor: { call: Math.floor, minimum: 1, maximum: 1 },
    ln: { call: Math.log, minimum: 1, maximum: 1 },
    log: { call: Math.log, minimum: 1, maximum: 1 },
    log10: { call: Math.log10, minimum: 1, maximum: 1 },
    max: { call: Math.max, minimum: 1, maximum: Infinity },
    min: { call: Math.min, minimum: 1, maximum: Infinity },
    pow: { call: Math.pow, minimum: 2, maximum: 2 },
    round: { call: Math.round, minimum: 1, maximum: 1 },
    sign: { call: Math.sign, minimum: 1, maximum: 1 },
    sin: { call: Math.sin, minimum: 1, maximum: 1 },
    sinh: { call: Math.sinh, minimum: 1, maximum: 1 },
    sqrt: { call: Math.sqrt, minimum: 1, maximum: 1 },
    tan: { call: Math.tan, minimum: 1, maximum: 1 },
    tanh: { call: Math.tanh, minimum: 1, maximum: 1 },
});

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u;
const RESERVED_NAMES = new Set([
    "t",
    ...Object.keys(CONSTANTS),
    ...Object.keys(FUNCTIONS),
]);

function expressionError(message, line, column = null) {
    const where = column === null
        ? `строка ${line}`
        : `строка ${line}, позиция ${column}`;
    return new Error(`${message} (${where}).`);
}

function tokenize(text, line) {
    const tokens = [];
    let offset = 0;

    while (offset < text.length) {
        const character = text[offset];
        if (/\s/u.test(character)) {
            offset += 1;
            continue;
        }

        const numberMatch = text.slice(offset).match(NUMBER);
        if (numberMatch) {
            tokens.push({
                type: "number",
                value: Number(numberMatch[0]),
                column: offset + 1,
            });
            offset += numberMatch[0].length;
            continue;
        }

        if (/[A-Za-z_]/u.test(character)) {
            let end = offset + 1;
            while (end < text.length && /[A-Za-z0-9_]/u.test(text[end])) {
                end += 1;
            }
            tokens.push({
                type: "identifier",
                value: text.slice(offset, end),
                column: offset + 1,
            });
            offset = end;
            continue;
        }

        if ("+-*/^(),=".includes(character)) {
            tokens.push({
                type: character,
                value: character,
                column: offset + 1,
            });
            offset += 1;
            continue;
        }

        throw expressionError(
            `Недопустимый символ '${character}'`,
            line,
            offset + 1,
        );
    }

    tokens.push({ type: "eof", value: null, column: text.length + 1 });
    return tokens;
}

class ExpressionParser {
    constructor(text, line) {
        this.line = line;
        this.tokens = tokenize(text, line);
        this.index = 0;
    }

    current() {
        return this.tokens[this.index];
    }

    peek(offset = 1) {
        return this.tokens[this.index + offset] ?? this.tokens.at(-1);
    }

    take(type) {
        const token = this.current();
        if (token.type !== type) return null;
        this.index += 1;
        return token;
    }

    require(type, message) {
        const token = this.take(type);
        if (token) return token;
        throw expressionError(message, this.line, this.current().column);
    }

    parseStatement() {
        if (
            this.current().type === "identifier"
            && this.peek().type === "="
        ) {
            const name = this.take("identifier");
            this.take("=");
            if (RESERVED_NAMES.has(name.value)) {
                throw expressionError(
                    `Имя '${name.value}' зарезервировано`,
                    this.line,
                    name.column,
                );
            }
            const value = this.parseExpression();
            this.require("eof", "После выражения остались лишние символы");
            return {
                type: "assignment",
                name: name.value,
                value,
                line: this.line,
            };
        }

        const value = this.parseExpression();
        this.require("eof", "После выражения остались лишние символы");
        return { type: "expression", value, line: this.line };
    }

    parseExpression() {
        let node = this.parseTerm();

        while (this.current().type === "+" || this.current().type === "-") {
            const operator = this.current().type;
            this.index += 1;
            node = {
                type: "binary",
                operator,
                left: node,
                right: this.parseTerm(),
                line: this.line,
            };
        }

        return node;
    }

    parseTerm() {
        let node = this.parseUnary();

        while (true) {
            let operator = null;
            if (this.current().type === "*" || this.current().type === "/") {
                operator = this.current().type;
                this.index += 1;
            } else if (this.startsImplicitFactor(this.current())) {
                operator = "*";
            }

            if (!operator) return node;
            node = {
                type: "binary",
                operator,
                left: node,
                right: this.parseUnary(),
                line: this.line,
            };
        }
    }

    startsImplicitFactor(token) {
        return token.type === "number"
            || token.type === "identifier"
            || token.type === "(";
    }

    parseUnary() {
        if (this.current().type === "+" || this.current().type === "-") {
            const operator = this.current().type;
            this.index += 1;
            return {
                type: "unary",
                operator,
                value: this.parseUnary(),
                line: this.line,
            };
        }
        return this.parsePower();
    }

    parsePower() {
        let node = this.parsePrimary();
        if (this.take("^")) {
            node = {
                type: "binary",
                operator: "^",
                left: node,
                right: this.parseUnary(),
                line: this.line,
            };
        }
        return node;
    }

    parsePrimary() {
        const number = this.take("number");
        if (number) {
            return { type: "number", value: number.value, line: this.line };
        }

        const identifier = this.take("identifier");
        if (identifier) {
            if (!this.take("(")) {
                return {
                    type: "variable",
                    name: identifier.value,
                    line: this.line,
                    column: identifier.column,
                };
            }

            const args = [];
            if (this.current().type !== ")") {
                do {
                    args.push(this.parseExpression());
                } while (this.take(","));
            }
            this.require(")", "Ожидалась закрывающая скобка");
            return {
                type: "call",
                name: identifier.value,
                args,
                line: this.line,
                column: identifier.column,
            };
        }

        if (this.take("(")) {
            const node = this.parseExpression();
            this.require(")", "Ожидалась закрывающая скобка");
            return node;
        }

        throw expressionError(
            "Ожидалось число, переменная, функция или скобка",
            this.line,
            this.current().column,
        );
    }
}

function evaluateNode(node, scope) {
    switch (node.type) {
        case "number":
            return node.value;
        case "variable": {
            if (!Object.prototype.hasOwnProperty.call(scope, node.name)) {
                throw expressionError(
                    `Неизвестная переменная '${node.name}'`,
                    node.line,
                    node.column,
                );
            }
            return scope[node.name];
        }
        case "unary": {
            const value = evaluateNode(node.value, scope);
            return node.operator === "-" ? -value : value;
        }
        case "binary": {
            const left = evaluateNode(node.left, scope);
            const right = evaluateNode(node.right, scope);
            switch (node.operator) {
                case "+": return left + right;
                case "-": return left - right;
                case "*": return left * right;
                case "/": return left / right;
                case "^": return left ** right;
                default: throw new Error(`Неизвестная операция '${node.operator}'.`);
            }
        }
        case "call": {
            const descriptor = FUNCTIONS[node.name];
            if (!descriptor) {
                throw expressionError(
                    `Неизвестная функция '${node.name}'`,
                    node.line,
                    node.column,
                );
            }
            if (
                node.args.length < descriptor.minimum
                || node.args.length > descriptor.maximum
            ) {
                const expected = descriptor.minimum === descriptor.maximum
                    ? String(descriptor.minimum)
                    : `не менее ${descriptor.minimum}`;
                throw expressionError(
                    `Функция '${node.name}' ожидает ${expected} аргумента`,
                    node.line,
                    node.column,
                );
            }
            return descriptor.call(
                ...node.args.map(item => evaluateNode(item, scope)),
            );
        }
        default:
            throw new Error(`Неизвестный узел выражения '${node.type}'.`);
    }
}

function parseProgram(source) {
    const text = String(source ?? "");
    const statements = [];

    text.split(/\r?\n/u).forEach((sourceLine, index) => {
        const line = sourceLine.replace(/#.*$/u, "").trim();
        if (!line) return;
        statements.push(
            new ExpressionParser(line, index + 1).parseStatement(),
        );
    });

    if (statements.length === 0) {
        throw new Error("Формула не задана.");
    }

    return statements;
}

export function compileTimeExpression(source) {
    const statements = parseProgram(source);

    return (time) => {
        if (!Number.isFinite(time)) {
            throw new Error("Переменная t должна быть конечным числом.");
        }

        const scope = Object.assign(Object.create(null), CONSTANTS, { t: time });
        let result = 0;

        for (const statement of statements) {
            result = evaluateNode(statement.value, scope);
            if (!Number.isFinite(result)) {
                throw expressionError(
                    "Результат вычисления не является конечным числом",
                    statement.line,
                );
            }
            if (statement.type === "assignment") {
                scope[statement.name] = result;
            }
        }

        return result;
    };
}

export const TIME_EXPRESSION_HELP = Object.freeze({
    variable: "t",
    constants: Object.keys(CONSTANTS),
    functions: Object.keys(FUNCTIONS),
});

export function isExpressionIdentifier(value) {
    return IDENTIFIER.test(String(value ?? ""));
}
