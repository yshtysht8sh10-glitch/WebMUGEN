export type TriggerExpression =
  | BooleanTriggerExpression
  | IdentifierTriggerExpression
  | NumberLiteralTriggerExpression
  | StringLiteralTriggerExpression
  | BinaryTriggerExpression;

export type BooleanTriggerExpression = {
  kind: 'Boolean';
  value: boolean;
};

export type IdentifierTriggerExpression = {
  kind: 'Identifier';
  name: string;
};

export type NumberLiteralTriggerExpression = {
  kind: 'NumberLiteral';
  value: number;
};

export type StringLiteralTriggerExpression = {
  kind: 'StringLiteral';
  value: string;
};

export type BinaryTriggerExpression = {
  kind: 'Binary';
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  left: TriggerExpression;
  right: TriggerExpression;
};
