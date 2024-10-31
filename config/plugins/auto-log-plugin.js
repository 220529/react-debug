// auto-log-plugin.js
// const pt = require("path"); // 导入 path 模块用于处理文件路径
const htmlTags = require("html-tags"); // 导入 HTML 标签列表
const template = require("@babel/template").default; // 导入 Babel 模板生成器

module.exports = function ({ types: t }, defaultConfig) {
  // 合并默认配置与自定义配置
  const config = {
    risks: "all",
    ...defaultConfig,
    ignore: htmlTags.concat(defaultConfig.ignore || []), // 需要忽略的标签包括原生 HTML 标签
    hocTag: "_ERROR_HOC_", // 定义高阶组件的前缀
    hocAttr: "isCatchReactError", // 定义高阶组件的属性名称
  };

  /**
   * 递归查找给定变量名称的 JSX 元素所在的作用域
   *
   * @param {Scope} scope - 当前的作用域
   * @param {string} variableName - 要查找的变量名称
   * @returns {Scope|null} - 找到的作用域或 null
   */
  const findJSXElementScope = (scope, variableName) => {
    if (scope.hasOwnBinding(variableName)) {
      return scope; // 如果当前作用域中存在变量绑定，返回该作用域
    } else {
      if (scope && scope.parent) {
        return findJSXElementScope(scope.parent, variableName); // 向上查找父作用域
      } else {
        console.log(`未找到 ${variableName} 变量的作用域`); // 未找到变量时打印日志
      }
    }
  };

  // 创建高阶组件的逻辑
  const createHoc = (path, tagName) => {
    const componentsName = `${config.hocTag}${tagName}`; // 生成高阶组件的名称
    // 找到组件所在的包裹组件的作用域
    const variableScope = findJSXElementScope(path.scope, tagName);
    const variableScopeNode = variableScope.path;

    // 检查当前组件是否已经转换过
    const isTransform = variableScopeNode.__transformInfo?.includes(tagName);
    // 如果没有转换过，则进行转换
    if (!isTransform) {
      // 创建高阶组件的节点代码
      const hocNode = `const ${componentsName} = ${config.errorHandleComponent}(${tagName})`;
      // 使用模板生成 AST 节点
      const hocComponent = template.ast(hocNode);

      // 检查包裹组件的节点是否是代码块
      if (variableScopeNode.node.body.type === "BlockStatement") {
        // 如果是代码块，插入高阶组件节点到 return 语句前
        const len = variableScopeNode.node.body.body.length;
        variableScopeNode.node.body.body.splice(len - 1, 0, hocComponent);
      } else {
        // 如果不是代码块，直接将高阶组件节点推入 body
        variableScopeNode.node.body.push(hocComponent);
      }

      // 记录已转换的组件名
      if (!Array.isArray(variableScopeNode.__transformInfo)) {
        variableScopeNode.__transformInfo = [];
      }
      variableScopeNode.__transformInfo.push(tagName);
    }
    return componentsName; // 返回高阶组件名称
  };

  const customComponentVisitor = {
    // 处理每个遇到的 JSX 元素，创建新的 JSX 节点替换旧的
    JSXElement(path) {
      // 获取旧的 JSX 节点
      const oldJsx = path.node;

      // 获取当前 JSX 元素的标签名称
      const jsxName = oldJsx.openingElement.name.name;

      // 过滤掉原生标签和需要忽略的标签
      if (config.ignore.includes(jsxName)) {
        return;
      }

      // 过滤掉已经转换过的组件
      if (jsxName.indexOf(config.hocTag) > -1) {
        return;
      }

      // 过滤掉无风险的组件
      if (config.risks !== "all" && !config.risks.includes(jsxName)) {
        return;
      }

      try {
        const HOC_NAME = createHoc(path, jsxName); // 创建高阶组件并返回名称
        if (HOC_NAME) {
          // 创建新的 JSX 属性，用于标记该组件为高阶组件
          let isReactErrorSentinelAttr = t.jsxAttribute(
            t.jsxIdentifier(config.hocAttr)
          );

          // 构建新的 JSX 开始元素
          let openingElement = t.JSXOpeningElement(t.JSXIdentifier(HOC_NAME), [
            isReactErrorSentinelAttr,
            ...oldJsx.openingElement.attributes, // 保留旧的属性
          ]);

          // 构建新的 JSX 结束元素
          let closingElement = t.JSXClosingElement(t.JSXIdentifier(HOC_NAME));

          // 构建新的完整 JSX 元素
          let newJsx = t.JSXElement(
            openingElement,
            closingElement,
            oldJsx.children || [] // 保留旧的子节点
          );

          // 使用新的 JSX 元素替换旧的元素
          path.replaceWith(newJsx);
        }
      } catch (e) {
        console.error(e); // 捕获并打印错误
      }
    },
  };

  return {
    visitor: {
      // 在生成的 AST 中的程序节点（Program）的开头插入必要的导入语句
      Program(path) {
        let isJsxFile = false; // 标志文件是否包含 JSX

        // 遍历 Program 的 body
        path.traverse({
          JSXElement() {
            // 找到 JSXElement，设置标志
            isJsxFile = true;
          },
          JSXFragment() {
            // 找到 JSXFragment，设置标志
            isJsxFile = true;
          },
        });

        // 如果文件包含 JSX，插入导入语句
        if (isJsxFile) {
          path.node.body.unshift(template.ast(config.imports)); // 在文件开头插入导入语句
        }
      },
      // 这个函数是一个访问器（visitor），用于处理 AST 中的返回语句节点。
      // 当解析器遇到 return 语句时，它会调用此函数
      ReturnStatement(path) {
        // 检查返回的节点类型是否为 JSXElement
        if (path.node.argument.type === "JSXElement") {
          // 如果返回的是 JSX 元素，遍历自定义组件访问器
          path.traverse(customComponentVisitor);
        }
      },
    },
  };
};
