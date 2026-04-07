import path from 'node:path';
import type { PluginObj } from '@babel/core';
import type * as BabelTypesNamespace from '@babel/types';

export interface HotContextInjectionPluginOptions {
  hmrRuntimeImport: string;
  exclude?: (filename: string) => boolean;
}

export function normalizeModuleId(filename: string, cwd = process.cwd()): string {
  let moduleId = filename.replace(/^file:\/\//, '');

  if (moduleId.startsWith(cwd)) {
    moduleId = moduleId.slice(cwd.length);
    if (moduleId.startsWith('/')) {
      moduleId = moduleId.slice(1);
    }
  }

  return moduleId;
}

export function createHotContextInjectionPlugin(
  babel: { types: typeof BabelTypesNamespace },
  options: HotContextInjectionPluginOptions,
): PluginObj {
  const { types: t } = babel;

  return {
    name: 'ember-tui-hot-context-injection',
    visitor: {
      Program(programPath, state) {
        const filename = state.filename;

        if (!filename || options.exclude?.(filename)) {
          return;
        }

        const normalizedFilename = filename.replace(/^file:\/\//, '');
        const runtimeImportSource = options.hmrRuntimeImport;
        let hasCreateHotContextBinding = false;
        let hasHotAssignment = false;
        let insertionIndex = 0;

        for (const [index, statement] of programPath.node.body.entries()) {
          if (t.isImportDeclaration(statement)) {
            insertionIndex = index + 1;

            for (const specifier of statement.specifiers) {
              if (
                t.isImportSpecifier(specifier) &&
                t.isIdentifier(specifier.imported, { name: 'createHotContext' })
              ) {
                const importSource = statement.source.value;
                const resolvedImportSource = importSource.startsWith('.')
                  ? path.resolve(path.dirname(normalizedFilename), importSource)
                  : importSource;

                if (resolvedImportSource === runtimeImportSource) {
                  hasCreateHotContextBinding = true;
                }
              }
            }
          }

          if (
            t.isExpressionStatement(statement) &&
            t.isAssignmentExpression(statement.expression, { operator: '=' }) &&
            t.isMemberExpression(statement.expression.left) &&
            t.isMetaProperty(statement.expression.left.object) &&
            t.isIdentifier(statement.expression.left.property, { name: 'hot' })
          ) {
            hasHotAssignment = true;
          }
        }

        if (hasHotAssignment) {
          return;
        }

        const moduleId = normalizeModuleId(filename);

        if (!hasCreateHotContextBinding) {
          const importDeclaration = t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier('createHotContext'),
                t.identifier('createHotContext'),
              ),
            ],
            t.stringLiteral(runtimeImportSource),
          );

          programPath.node.body.splice(insertionIndex, 0, importDeclaration);
          insertionIndex += 1;
        }

        const hotAssignment = t.ifStatement(
          t.logicalExpression(
            '&&',
            t.binaryExpression(
              '!==',
              t.unaryExpression(
                'typeof',
                t.metaProperty(t.identifier('import'), t.identifier('meta')),
              ),
              t.stringLiteral('undefined'),
            ),
            t.unaryExpression(
              '!',
              t.memberExpression(
                t.metaProperty(t.identifier('import'), t.identifier('meta')),
                t.identifier('hot'),
              ),
            ),
          ),
          t.expressionStatement(
            t.assignmentExpression(
              '=',
              t.memberExpression(
                t.metaProperty(t.identifier('import'), t.identifier('meta')),
                t.identifier('hot'),
              ),
              t.callExpression(t.identifier('createHotContext'), [t.stringLiteral(moduleId)]),
            ),
          ),
        );

        programPath.node.body.splice(insertionIndex, 0, hotAssignment);
      },
    },
  };
}
