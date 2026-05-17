"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const electron = require("electron");
const path = require("path");
const url = require("url");
const promises = require("fs/promises");
const readability = require("@mozilla/readability");
const jsdom = require("jsdom");
const sharp = require("sharp");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function createMenu(mainWindow2) {
  const menu = electron.Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "New Board",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow2.webContents.send("menu:new-board")
        },
        { type: "separator" },
        {
          label: "Open Workspace...",
          accelerator: "CmdOrCtrl+O",
          click: () => mainWindow2.webContents.send("menu:open-workspace")
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" }
      ]
    }
  ]);
  electron.Menu.setApplicationMenu(menu);
}
const DEBUG = process.env.HEPTA_DEBUG === "1";
function prefix(level) {
  return level === "debug" ? "[clipper:debug]" : `[clipper:${level}]`;
}
const log = {
  info(msg) {
    console.log(`${prefix("info")} ${msg}`);
  },
  debug(msg) {
    DEBUG && console.log(`${prefix("debug")} ${msg}`);
  },
  warn(msg) {
    console.warn(`${prefix("warn")} ${msg}`);
  },
  error(msg) {
    console.error(`${prefix("error")} ${msg}`);
  }
};
function extend(destination) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) destination[key] = source[key];
    }
  }
  return destination;
}
function repeat(character, count) {
  return Array(count + 1).join(character);
}
function trimLeadingNewlines(string) {
  return string.replace(/^\n*/, "");
}
function trimTrailingNewlines(string) {
  var indexEnd = string.length;
  while (indexEnd > 0 && string[indexEnd - 1] === "\n") indexEnd--;
  return string.substring(0, indexEnd);
}
function trimNewlines(string) {
  return trimTrailingNewlines(trimLeadingNewlines(string));
}
var blockElements = ["ADDRESS", "ARTICLE", "ASIDE", "AUDIO", "BLOCKQUOTE", "BODY", "CANVAS", "CENTER", "DD", "DIR", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "FRAMESET", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HGROUP", "HR", "HTML", "ISINDEX", "LI", "MAIN", "MENU", "NAV", "NOFRAMES", "NOSCRIPT", "OL", "OUTPUT", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL"];
function isBlock(node) {
  return is(node, blockElements);
}
var voidElements = ["AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG", "INPUT", "KEYGEN", "LINK", "META", "PARAM", "SOURCE", "TRACK", "WBR"];
function isVoid(node) {
  return is(node, voidElements);
}
function hasVoid(node) {
  return has(node, voidElements);
}
var meaningfulWhenBlankElements = ["A", "TABLE", "THEAD", "TBODY", "TFOOT", "TH", "TD", "IFRAME", "SCRIPT", "AUDIO", "VIDEO"];
function isMeaningfulWhenBlank(node) {
  return is(node, meaningfulWhenBlankElements);
}
function hasMeaningfulWhenBlank(node) {
  return has(node, meaningfulWhenBlankElements);
}
function is(node, tagNames) {
  return tagNames.indexOf(node.nodeName) >= 0;
}
function has(node, tagNames) {
  return node.getElementsByTagName && tagNames.some(function(tagName) {
    return node.getElementsByTagName(tagName).length;
  });
}
var markdownEscapes = [[/\\/g, "\\\\"], [/\*/g, "\\*"], [/^-/g, "\\-"], [/^\+ /g, "\\+ "], [/^(=+)/g, "\\$1"], [/^(#{1,6}) /g, "\\$1 "], [/`/g, "\\`"], [/^~~~/g, "\\~~~"], [/\[/g, "\\["], [/\]/g, "\\]"], [/^>/g, "\\>"], [/_/g, "\\_"], [/^(\d+)\. /g, "$1\\. "]];
function escapeMarkdown(string) {
  return markdownEscapes.reduce(function(accumulator, escape) {
    return accumulator.replace(escape[0], escape[1]);
  }, string);
}
var rules = {};
rules.paragraph = {
  filter: "p",
  replacement: function(content) {
    return "\n\n" + content + "\n\n";
  }
};
rules.lineBreak = {
  filter: "br",
  replacement: function(content, node, options) {
    return options.br + "\n";
  }
};
rules.heading = {
  filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
  replacement: function(content, node, options) {
    var hLevel = Number(node.nodeName.charAt(1));
    if (options.headingStyle === "setext" && hLevel < 3) {
      var underline = repeat(hLevel === 1 ? "=" : "-", content.length);
      return "\n\n" + content + "\n" + underline + "\n\n";
    } else {
      return "\n\n" + repeat("#", hLevel) + " " + content + "\n\n";
    }
  }
};
rules.blockquote = {
  filter: "blockquote",
  replacement: function(content) {
    content = trimNewlines(content).replace(/^/gm, "> ");
    return "\n\n" + content + "\n\n";
  }
};
rules.list = {
  filter: ["ul", "ol"],
  replacement: function(content, node) {
    var parent = node.parentNode;
    if (parent.nodeName === "LI" && parent.lastElementChild === node) {
      return "\n" + content;
    } else {
      return "\n\n" + content + "\n\n";
    }
  }
};
rules.listItem = {
  filter: "li",
  replacement: function(content, node, options) {
    var prefix2 = options.bulletListMarker + "   ";
    var parent = node.parentNode;
    if (parent.nodeName === "OL") {
      var start = parent.getAttribute("start");
      var index = Array.prototype.indexOf.call(parent.children, node);
      prefix2 = (start ? Number(start) + index : index + 1) + ".  ";
    }
    var isParagraph = /\n$/.test(content);
    content = trimNewlines(content) + (isParagraph ? "\n" : "");
    content = content.replace(/\n/gm, "\n" + " ".repeat(prefix2.length));
    return prefix2 + content + (node.nextSibling ? "\n" : "");
  }
};
rules.indentedCodeBlock = {
  filter: function(node, options) {
    return options.codeBlockStyle === "indented" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
  },
  replacement: function(content, node, options) {
    return "\n\n    " + node.firstChild.textContent.replace(/\n/g, "\n    ") + "\n\n";
  }
};
rules.fencedCodeBlock = {
  filter: function(node, options) {
    return options.codeBlockStyle === "fenced" && node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE";
  },
  replacement: function(content, node, options) {
    var className = node.firstChild.getAttribute("class") || "";
    var language = (className.match(/language-(\S+)/) || [null, ""])[1];
    var code = node.firstChild.textContent;
    var fenceChar = options.fence.charAt(0);
    var fenceSize = 3;
    var fenceInCodeRegex = new RegExp("^" + fenceChar + "{3,}", "gm");
    var match;
    while (match = fenceInCodeRegex.exec(code)) {
      if (match[0].length >= fenceSize) {
        fenceSize = match[0].length + 1;
      }
    }
    var fence = repeat(fenceChar, fenceSize);
    return "\n\n" + fence + language + "\n" + code.replace(/\n$/, "") + "\n" + fence + "\n\n";
  }
};
rules.horizontalRule = {
  filter: "hr",
  replacement: function(content, node, options) {
    return "\n\n" + options.hr + "\n\n";
  }
};
rules.inlineLink = {
  filter: function(node, options) {
    return options.linkStyle === "inlined" && node.nodeName === "A" && node.getAttribute("href");
  },
  replacement: function(content, node) {
    var href = escapeLinkDestination(node.getAttribute("href"));
    var title = escapeLinkTitle(cleanAttribute(node.getAttribute("title")));
    var titlePart = title ? ' "' + title + '"' : "";
    return "[" + content + "](" + href + titlePart + ")";
  }
};
rules.referenceLink = {
  filter: function(node, options) {
    return options.linkStyle === "referenced" && node.nodeName === "A" && node.getAttribute("href");
  },
  replacement: function(content, node, options) {
    var href = escapeLinkDestination(node.getAttribute("href"));
    var title = cleanAttribute(node.getAttribute("title"));
    if (title) title = ' "' + escapeLinkTitle(title) + '"';
    var replacement;
    var reference;
    switch (options.linkReferenceStyle) {
      case "collapsed":
        replacement = "[" + content + "][]";
        reference = "[" + content + "]: " + href + title;
        break;
      case "shortcut":
        replacement = "[" + content + "]";
        reference = "[" + content + "]: " + href + title;
        break;
      default:
        var id = this.references.length + 1;
        replacement = "[" + content + "][" + id + "]";
        reference = "[" + id + "]: " + href + title;
    }
    this.references.push(reference);
    return replacement;
  },
  references: [],
  append: function(options) {
    var references = "";
    if (this.references.length) {
      references = "\n\n" + this.references.join("\n") + "\n\n";
      this.references = [];
    }
    return references;
  }
};
rules.emphasis = {
  filter: ["em", "i"],
  replacement: function(content, node, options) {
    if (!content.trim()) return "";
    return options.emDelimiter + content + options.emDelimiter;
  }
};
rules.strong = {
  filter: ["strong", "b"],
  replacement: function(content, node, options) {
    if (!content.trim()) return "";
    return options.strongDelimiter + content + options.strongDelimiter;
  }
};
rules.code = {
  filter: function(node) {
    var hasSiblings = node.previousSibling || node.nextSibling;
    var isCodeBlock = node.parentNode.nodeName === "PRE" && !hasSiblings;
    return node.nodeName === "CODE" && !isCodeBlock;
  },
  replacement: function(content) {
    if (!content) return "";
    content = content.replace(/\r?\n|\r/g, " ");
    var extraSpace = /^`|^ .*?[^ ].* $|`$/.test(content) ? " " : "";
    var delimiter = "`";
    var matches = content.match(/`+/gm) || [];
    while (matches.indexOf(delimiter) !== -1) delimiter = delimiter + "`";
    return delimiter + extraSpace + content + extraSpace + delimiter;
  }
};
rules.image = {
  filter: "img",
  replacement: function(content, node) {
    var alt = escapeMarkdown(cleanAttribute(node.getAttribute("alt")));
    var src = escapeLinkDestination(node.getAttribute("src") || "");
    var title = cleanAttribute(node.getAttribute("title"));
    var titlePart = title ? ' "' + escapeLinkTitle(title) + '"' : "";
    return src ? "![" + alt + "](" + src + titlePart + ")" : "";
  }
};
function cleanAttribute(attribute) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : "";
}
function escapeLinkDestination(destination) {
  var escaped = destination.replace(/([<>()])/g, "\\$1");
  return escaped.indexOf(" ") >= 0 ? "<" + escaped + ">" : escaped;
}
function escapeLinkTitle(title) {
  return title.replace(/"/g, '\\"');
}
function Rules(options) {
  this.options = options;
  this._keep = [];
  this._remove = [];
  this.blankRule = {
    replacement: options.blankReplacement
  };
  this.keepReplacement = options.keepReplacement;
  this.defaultRule = {
    replacement: options.defaultReplacement
  };
  this.array = [];
  for (var key in options.rules) this.array.push(options.rules[key]);
}
Rules.prototype = {
  add: function(key, rule) {
    this.array.unshift(rule);
  },
  keep: function(filter) {
    this._keep.unshift({
      filter,
      replacement: this.keepReplacement
    });
  },
  remove: function(filter) {
    this._remove.unshift({
      filter,
      replacement: function() {
        return "";
      }
    });
  },
  forNode: function(node) {
    if (node.isBlank) return this.blankRule;
    var rule;
    if (rule = findRule(this.array, node, this.options)) return rule;
    if (rule = findRule(this._keep, node, this.options)) return rule;
    if (rule = findRule(this._remove, node, this.options)) return rule;
    return this.defaultRule;
  },
  forEach: function(fn) {
    for (var i = 0; i < this.array.length; i++) fn(this.array[i], i);
  }
};
function findRule(rules2, node, options) {
  for (var i = 0; i < rules2.length; i++) {
    var rule = rules2[i];
    if (filterValue(rule, node, options)) return rule;
  }
  return void 0;
}
function filterValue(rule, node, options) {
  var filter = rule.filter;
  if (typeof filter === "string") {
    if (filter === node.nodeName.toLowerCase()) return true;
  } else if (Array.isArray(filter)) {
    if (filter.indexOf(node.nodeName.toLowerCase()) > -1) return true;
  } else if (typeof filter === "function") {
    if (filter.call(rule, node, options)) return true;
  } else {
    throw new TypeError("`filter` needs to be a string, array, or function");
  }
}
function collapseWhitespace(options) {
  var element = options.element;
  var isBlock2 = options.isBlock;
  var isVoid2 = options.isVoid;
  var isPre = options.isPre || function(node2) {
    return node2.nodeName === "PRE";
  };
  if (!element.firstChild || isPre(element)) return;
  var prevText = null;
  var keepLeadingWs = false;
  var prev = null;
  var node = next(prev, element, isPre);
  while (node !== element) {
    if (node.nodeType === 3 || node.nodeType === 4) {
      var text = node.data.replace(/[ \r\n\t]+/g, " ");
      if ((!prevText || / $/.test(prevText.data)) && !keepLeadingWs && text[0] === " ") {
        text = text.substr(1);
      }
      if (!text) {
        node = remove(node);
        continue;
      }
      node.data = text;
      prevText = node;
    } else if (node.nodeType === 1) {
      if (isBlock2(node) || node.nodeName === "BR") {
        if (prevText) {
          prevText.data = prevText.data.replace(/ $/, "");
        }
        prevText = null;
        keepLeadingWs = false;
      } else if (isVoid2(node) || isPre(node)) {
        prevText = null;
        keepLeadingWs = true;
      } else if (prevText) {
        keepLeadingWs = false;
      }
    } else {
      node = remove(node);
      continue;
    }
    var nextNode = next(prev, node, isPre);
    prev = node;
    node = nextNode;
  }
  if (prevText) {
    prevText.data = prevText.data.replace(/ $/, "");
    if (!prevText.data) {
      remove(prevText);
    }
  }
}
function remove(node) {
  var next2 = node.nextSibling || node.parentNode;
  node.parentNode.removeChild(node);
  return next2;
}
function next(prev, current, isPre) {
  if (prev && prev.parentNode === current || isPre(current)) {
    return current.nextSibling || current.parentNode;
  }
  return current.firstChild || current.nextSibling || current.parentNode;
}
var root = typeof window !== "undefined" ? window : {};
function canParseHTMLNatively() {
  var Parser = root.DOMParser;
  var canParse = false;
  try {
    if (new Parser().parseFromString("", "text/html")) {
      canParse = true;
    }
  } catch (e) {
  }
  return canParse;
}
function createHTMLParser() {
  var Parser = function() {
  };
  {
    var domino = require("@mixmark-io/domino");
    Parser.prototype.parseFromString = function(string) {
      return domino.createDocument(string);
    };
  }
  return Parser;
}
var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();
function RootNode(input, options) {
  var root2;
  if (typeof input === "string") {
    var doc = htmlParser().parseFromString(
      // DOM parsers arrange elements in the <head> and <body>.
      // Wrapping in a custom element ensures elements are reliably arranged in
      // a single element.
      '<x-turndown id="turndown-root">' + input + "</x-turndown>",
      "text/html"
    );
    root2 = doc.getElementById("turndown-root");
  } else {
    root2 = input.cloneNode(true);
  }
  collapseWhitespace({
    element: root2,
    isBlock,
    isVoid,
    isPre: options.preformattedCode ? isPreOrCode : null
  });
  return root2;
}
var _htmlParser;
function htmlParser() {
  _htmlParser = _htmlParser || new HTMLParser();
  return _htmlParser;
}
function isPreOrCode(node) {
  return node.nodeName === "PRE" || node.nodeName === "CODE";
}
function Node(node, options) {
  node.isBlock = isBlock(node);
  node.isCode = node.nodeName === "CODE" || node.parentNode.isCode;
  node.isBlank = isBlank(node);
  node.flankingWhitespace = flankingWhitespace(node, options);
  return node;
}
function isBlank(node) {
  return !isVoid(node) && !isMeaningfulWhenBlank(node) && /^\s*$/i.test(node.textContent) && !hasVoid(node) && !hasMeaningfulWhenBlank(node);
}
function flankingWhitespace(node, options) {
  if (node.isBlock || options.preformattedCode && node.isCode) {
    return {
      leading: "",
      trailing: ""
    };
  }
  var edges = edgeWhitespace(node.textContent);
  if (edges.leadingAscii && isFlankedByWhitespace("left", node, options)) {
    edges.leading = edges.leadingNonAscii;
  }
  if (edges.trailingAscii && isFlankedByWhitespace("right", node, options)) {
    edges.trailing = edges.trailingNonAscii;
  }
  return {
    leading: edges.leading,
    trailing: edges.trailing
  };
}
function edgeWhitespace(string) {
  var m = string.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);
  return {
    leading: m[1],
    // whole string for whitespace-only strings
    leadingAscii: m[2],
    leadingNonAscii: m[3],
    trailing: m[4],
    // empty for whitespace-only strings
    trailingNonAscii: m[5],
    trailingAscii: m[6]
  };
}
function isFlankedByWhitespace(side, node, options) {
  var sibling;
  var regExp;
  var isFlanked;
  if (side === "left") {
    sibling = node.previousSibling;
    regExp = / $/;
  } else {
    sibling = node.nextSibling;
    regExp = /^ /;
  }
  if (sibling) {
    if (sibling.nodeType === 3) {
      isFlanked = regExp.test(sibling.nodeValue);
    } else if (options.preformattedCode && sibling.nodeName === "CODE") {
      isFlanked = false;
    } else if (sibling.nodeType === 1 && !isBlock(sibling)) {
      isFlanked = regExp.test(sibling.textContent);
    }
  }
  return isFlanked;
}
var reduce = Array.prototype.reduce;
function TurndownService(options) {
  if (!(this instanceof TurndownService)) return new TurndownService(options);
  var defaults = {
    rules,
    headingStyle: "setext",
    hr: "* * *",
    bulletListMarker: "*",
    codeBlockStyle: "indented",
    fence: "```",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
    linkReferenceStyle: "full",
    br: "  ",
    preformattedCode: false,
    blankReplacement: function(content, node) {
      return node.isBlock ? "\n\n" : "";
    },
    keepReplacement: function(content, node) {
      return node.isBlock ? "\n\n" + node.outerHTML + "\n\n" : node.outerHTML;
    },
    defaultReplacement: function(content, node) {
      return node.isBlock ? "\n\n" + content + "\n\n" : content;
    }
  };
  this.options = extend({}, defaults, options);
  this.rules = new Rules(this.options);
}
TurndownService.prototype = {
  /**
   * The entry point for converting a string or DOM node to Markdown
   * @public
   * @param {String|HTMLElement} input The string or DOM node to convert
   * @returns A Markdown representation of the input
   * @type String
   */
  turndown: function(input) {
    if (!canConvert(input)) {
      throw new TypeError(input + " is not a string, or an element/document/fragment node.");
    }
    if (input === "") return "";
    var output = process$1.call(this, new RootNode(input, this.options));
    return postProcess.call(this, output);
  },
  /**
   * Add one or more plugins
   * @public
   * @param {Function|Array} plugin The plugin or array of plugins to add
   * @returns The Turndown instance for chaining
   * @type Object
   */
  use: function(plugin) {
    if (Array.isArray(plugin)) {
      for (var i = 0; i < plugin.length; i++) this.use(plugin[i]);
    } else if (typeof plugin === "function") {
      plugin(this);
    } else {
      throw new TypeError("plugin must be a Function or an Array of Functions");
    }
    return this;
  },
  /**
   * Adds a rule
   * @public
   * @param {String} key The unique key of the rule
   * @param {Object} rule The rule
   * @returns The Turndown instance for chaining
   * @type Object
   */
  addRule: function(key, rule) {
    this.rules.add(key, rule);
    return this;
  },
  /**
   * Keep a node (as HTML) that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */
  keep: function(filter) {
    this.rules.keep(filter);
    return this;
  },
  /**
   * Remove a node that matches the filter
   * @public
   * @param {String|Array|Function} filter The unique key of the rule
   * @returns The Turndown instance for chaining
   * @type Object
   */
  remove: function(filter) {
    this.rules.remove(filter);
    return this;
  },
  /**
   * Escapes Markdown syntax
   * @public
   * @param {String} string The string to escape
   * @returns A string with Markdown syntax escaped
   * @type String
   */
  escape: function(string) {
    return escapeMarkdown(string);
  }
};
function process$1(parentNode) {
  var self = this;
  return reduce.call(parentNode.childNodes, function(output, node) {
    node = new Node(node, self.options);
    var replacement = "";
    if (node.nodeType === 3) {
      replacement = node.isCode ? node.nodeValue : self.escape(node.nodeValue);
    } else if (node.nodeType === 1) {
      replacement = replacementForNode.call(self, node);
    }
    return join(output, replacement);
  }, "");
}
function postProcess(output) {
  var self = this;
  this.rules.forEach(function(rule) {
    if (typeof rule.append === "function") {
      output = join(output, rule.append(self.options));
    }
  });
  return output.replace(/^[\t\r\n]+/, "").replace(/[\t\r\n\s]+$/, "");
}
function replacementForNode(node) {
  var rule = this.rules.forNode(node);
  var content = process$1.call(this, node);
  var whitespace = node.flankingWhitespace;
  if (whitespace.leading || whitespace.trailing) content = content.trim();
  return whitespace.leading + rule.replacement(content, node, this.options) + whitespace.trailing;
}
function join(output, replacement) {
  var s1 = trimTrailingNewlines(output);
  var s2 = trimLeadingNewlines(replacement);
  var nls = Math.max(output.length - s1.length, replacement.length - s2.length);
  var separator = "\n\n".substring(0, nls);
  return s1 + separator + s2;
}
function canConvert(input) {
  return input != null && (typeof input === "string" || input.nodeType && (input.nodeType === 1 || input.nodeType === 9 || input.nodeType === 11));
}
const turndown_es = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: TurndownService
}, Symbol.toStringTag, { value: "Module" }));
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced"
});
function detectPlatform(url2) {
  const hostname = new URL(url2).hostname;
  if (hostname.includes("xiaohongshu.com") || hostname.includes("xhslink.com")) return "xiaohongshu";
  if (hostname.includes("mp.weixin.qq.com")) return "wechat";
  return "generic";
}
function extractContent(url2, rawHtml) {
  const doc = new jsdom.JSDOM(rawHtml, { url: url2 });
  const window2 = doc.window;
  for (const el of window2.document.querySelectorAll(
    "script, style, nav, footer, iframe, .ad, .advertisement"
  )) {
    el.remove();
  }
  const reader = new readability.Readability(window2.document);
  const article = reader.parse();
  if (!article || !article.content) {
    throw Object.assign(new Error("无法提取有效内容"), { code: "NO_CONTENT" });
  }
  const contentDoc = new jsdom.JSDOM(article.content).window.document;
  for (const img of contentDoc.querySelectorAll("img")) {
    const dataSrc = img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src");
    if (dataSrc && !img.getAttribute("src")) {
      img.setAttribute("src", dataSrc);
    }
    img.removeAttribute("style");
    img.removeAttribute("width");
    img.removeAttribute("height");
  }
  const html = contentDoc.body.innerHTML;
  const markdown = turndown.turndown(html);
  const imageUrls = Array.from(contentDoc.querySelectorAll("img")).map((img) => {
    var _a;
    return (_a = img.getAttribute("src")) == null ? void 0 : _a.trim();
  }).filter((src) => Boolean(src));
  log.info(`extracted: title="${article.title}", images=${imageUrls.length}`);
  return {
    title: article.title || new URL(url2).hostname,
    html,
    markdown,
    sourceUrl: url2,
    sourceName: new URL(url2).hostname,
    images: [],
    imageUrls
  };
}
function extractXHS(url2, rawHtml) {
  var _a, _b, _c;
  try {
    const match = rawHtml.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/s);
    if (!match) return null;
    const jsonStr = match[1].replace(/undefined/g, "null");
    const noteData = JSON.parse(jsonStr);
    const noteMap = (_a = noteData == null ? void 0 : noteData.note) == null ? void 0 : _a.noteDetailMap;
    if (!noteMap) return null;
    const noteEntry = Object.values(noteMap)[0];
    if (!(noteEntry == null ? void 0 : noteEntry.note)) return null;
    const { title, desc, imageList } = noteEntry.note;
    const htmlParts = [];
    if (title) htmlParts.push(`<h1>${title}</h1>`);
    if (desc) htmlParts.push(`<p>${desc}</p>`);
    const imageUrls = [];
    if (imageList && Array.isArray(imageList)) {
      for (const img of imageList) {
        const imgUrl = (img == null ? void 0 : img.urlDefault) || (img == null ? void 0 : img.url) || ((_c = (_b = img == null ? void 0 : img.infoList) == null ? void 0 : _b[0]) == null ? void 0 : _c.url);
        if (imgUrl) {
          imageUrls.push(imgUrl);
          htmlParts.push(`<p><img src="${imgUrl}" /></p>`);
        }
      }
    }
    if (htmlParts.length === 0) return null;
    const html = htmlParts.join("\n");
    log.info(`XHS extracted: title="${title}", images=${imageUrls.length}`);
    return {
      title: title || "小红书笔记",
      html,
      markdown: "",
      sourceUrl: url2,
      sourceName: "小红书",
      images: [],
      imageUrls
    };
  } catch (err) {
    log.warn(`XHS parse failed, falling back to generic: ${err}`);
    return null;
  }
}
function extractWeChat(url2, rawHtml) {
  var _a, _b;
  if (/captcha|TCaptcha|secitptpage|__DEBUGINFO/.test(rawHtml)) {
    throw Object.assign(
      new Error("微信公众号反爬验证拦截，请尝试在浏览器中打开文章后再剪藏"),
      { code: "WECHAT_CAPTCHA" }
    );
  }
  const doc = new jsdom.JSDOM(rawHtml, { url: url2 });
  const document2 = doc.window.document;
  const titleEl = document2.querySelector("#activity-name");
  const contentEl = document2.querySelector("#js_content");
  const authorEl = document2.querySelector("#js_name");
  if (!contentEl) {
    throw Object.assign(new Error("无法提取微信文章正文"), { code: "NO_CONTENT" });
  }
  const clone = contentEl.cloneNode(true);
  clone.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("style");
    if (el.hasAttribute("class")) {
      const cls = el.getAttribute("class") || "";
      el.setAttribute("class", cls.replace(/wx_[\w-]*/g, "").trim());
    }
  });
  for (const img of clone.querySelectorAll("img")) {
    const src = img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-url") || img.getAttribute("src") || "";
    if (src) img.setAttribute("src", src);
    img.removeAttribute("style");
    img.removeAttribute("width");
    img.removeAttribute("height");
  }
  const html = clone.innerHTML;
  const title = ((_a = titleEl == null ? void 0 : titleEl.textContent) == null ? void 0 : _a.trim()) || "微信公众号文章";
  const author = ((_b = authorEl == null ? void 0 : authorEl.textContent) == null ? void 0 : _b.trim()) || "";
  const imageUrls = Array.from(clone.querySelectorAll("img")).map((img) => {
    var _a2;
    return (_a2 = img.getAttribute("src")) == null ? void 0 : _a2.trim();
  }).filter((src) => Boolean(src));
  log.info(`WeChat extracted: title="${title}", author="${author}", images=${imageUrls.length}`);
  return {
    title,
    html,
    markdown: "",
    sourceUrl: url2,
    sourceName: author ? `微信公众号 · ${author}` : "微信公众号",
    images: [],
    imageUrls
  };
}
const JPEG_QUALITY = 85;
const MAX_WIDTH = 1200;
const SKIP_COMPRESS_THRESHOLD = 300 * 1024;
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeUrl(url2) {
  if (url2.startsWith("//")) return `https:${url2}`;
  return url2;
}
function getExtFromUrl(url2) {
  try {
    const pathname = new URL(url2).pathname;
    const ext = path.extname(pathname).toLowerCase().replace(".", "");
    if (["jpg", "jpeg", "png", "webp", "gif", "svg", "avif"].includes(ext)) return ext === "svg" ? "svg" : ext;
  } catch {
  }
  return "jpg";
}
async function downloadOne(url2, index, mediaDir) {
  const response = await fetch(url2, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: url2
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const originalSize = buffer.length;
  const ext = getExtFromUrl(url2);
  const localFilename = `${Date.now()}_${String(index).padStart(2, "0")}.${ext}`;
  const localPath = path.join(mediaDir, localFilename);
  if (ext === "svg" || ext === "gif") {
    await promises.writeFile(localPath, buffer);
    return { originalUrl: url2, localFilename, originalSize, compressedSize: originalSize };
  }
  if (originalSize < SKIP_COMPRESS_THRESHOLD) {
    await promises.writeFile(localPath, buffer);
    return { originalUrl: url2, localFilename, originalSize, compressedSize: originalSize };
  }
  let pipeline = sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true });
  let compressed;
  if (ext === "png") compressed = await pipeline.png({ quality: JPEG_QUALITY }).toBuffer();
  else if (ext === "webp") compressed = await pipeline.webp({ quality: JPEG_QUALITY }).toBuffer();
  else compressed = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
  await promises.writeFile(localPath, compressed);
  log.debug(`image compressed: ${url2} → ${localFilename} (${originalSize}→${compressed.length})`);
  return { originalUrl: url2, localFilename, originalSize, compressedSize: compressed.length };
}
async function downloadImages(imageUrls, workspacePath) {
  const uniqueUrls = [...new Set(imageUrls)].map(normalizeUrl).filter((u) => u.startsWith("http"));
  if (uniqueUrls.length === 0) return [];
  const mediaDir = path.join(workspacePath, "media");
  await promises.mkdir(mediaDir, { recursive: true });
  const results = [];
  for (let i = 0; i < uniqueUrls.length; i++) {
    try {
      const info = await downloadOne(uniqueUrls[i], results.length, mediaDir);
      results.push(info);
    } catch (err) {
      log.warn(`image download failed: ${err.message}, keeping original URL`);
    }
  }
  log.info(`images downloaded: ${results.length}/${uniqueUrls.length}`);
  return results;
}
function replaceImageUrls(html, markdown, imageInfos, workspacePath) {
  let newHtml = html;
  let newMarkdown = markdown;
  for (const info of imageInfos) {
    const localUrl = `hepta-media://${info.localFilename}?workspace=${encodeURIComponent(workspacePath)}`;
    newHtml = newHtml.replace(new RegExp(escapeRegExp(info.originalUrl), "g"), localUrl);
    newMarkdown = newMarkdown.replace(new RegExp(escapeRegExp(info.originalUrl), "g"), localUrl);
  }
  return { html: newHtml, markdown: newMarkdown };
}
async function handleClip(_event, body) {
  const { url: url2, workspacePath } = body;
  log.info(`clipping: ${url2}`);
  let rawHtml;
  try {
    const response = await fetch(url2, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25e3)
    });
    if (!response.ok) {
      const errBody = { error: `HTTP ${response.status}`, code: "FETCH_ERROR" };
      throw Object.assign(new Error(errBody.error), { code: errBody.code });
    }
    rawHtml = await response.text();
  } catch (err) {
    if (err.name === "TimeoutError" || err.code === "TimeoutError") {
      throw Object.assign(new Error("请求超时"), { code: "TIMEOUT" });
    }
    if (err.code === "FETCH_ERROR" || err.code === "WECHAT_CAPTCHA" || err.code === "NO_CONTENT") throw err;
    throw Object.assign(new Error(`无法访问该页面 (${err.message})`), { code: "FETCH_ERROR" });
  }
  const platform = detectPlatform(url2);
  let result;
  try {
    if (platform === "xiaohongshu") {
      const xhsResult = extractXHS(url2, rawHtml);
      result = xhsResult || extractContent(url2, rawHtml);
    } else if (platform === "wechat") {
      result = extractWeChat(url2, rawHtml);
    } else {
      result = extractContent(url2, rawHtml);
    }
  } catch (err) {
    if (err.code) throw err;
    throw Object.assign(new Error(`解析失败: ${err.message}`), { code: "PARSE_ERROR" });
  }
  if (!result.markdown && result.html) {
    const TurndownService2 = (await Promise.resolve().then(() => turndown_es)).default;
    const td = new TurndownService2({ headingStyle: "atx", codeBlockStyle: "fenced" });
    result.markdown = td.turndown(result.html);
  }
  const imageUrls = result.imageUrls || [];
  delete result.imageUrls;
  if (imageUrls.length > 0 && workspacePath) {
    const imageInfos = await downloadImages(imageUrls, workspacePath);
    const replaced = replaceImageUrls(result.html, result.markdown, imageInfos, workspacePath || "");
    result.html = replaced.html;
    result.markdown = replaced.markdown;
    result.images = imageInfos;
  }
  log.info(`clip complete: title="${result.title}", images=${result.images.length}`);
  return result;
}
function registerClipperHandlers() {
  electron.ipcMain.handle("clipper:clip", handleClip);
}
const c = new Int32Array(4);
const _h = class _h {
  constructor() {
    __publicField(this, "_dataLength", 0);
    __publicField(this, "_bufferLength", 0);
    __publicField(this, "_state", new Int32Array(4));
    __publicField(this, "_buffer", new ArrayBuffer(68));
    __publicField(this, "_buffer8");
    __publicField(this, "_buffer32");
    this._buffer8 = new Uint8Array(this._buffer, 0, 68), this._buffer32 = new Uint32Array(this._buffer, 0, 17), this.start();
  }
  static hashStr(i, a = false) {
    return this.onePassHasher.start().appendStr(i).end(a);
  }
  static hashAsciiStr(i, a = false) {
    return this.onePassHasher.start().appendAsciiStr(i).end(a);
  }
  static _hex(i) {
    const a = _h.hexChars, t = _h.hexOut;
    let e, s, r, n;
    for (n = 0; n < 4; n += 1)
      for (s = n * 8, e = i[n], r = 0; r < 8; r += 2)
        t[s + 1 + r] = a.charAt(e & 15), e >>>= 4, t[s + 0 + r] = a.charAt(e & 15), e >>>= 4;
    return t.join("");
  }
  static _md5cycle(i, a) {
    let t = i[0], e = i[1], s = i[2], r = i[3];
    t += (e & s | ~e & r) + a[0] - 680876936 | 0, t = (t << 7 | t >>> 25) + e | 0, r += (t & e | ~t & s) + a[1] - 389564586 | 0, r = (r << 12 | r >>> 20) + t | 0, s += (r & t | ~r & e) + a[2] + 606105819 | 0, s = (s << 17 | s >>> 15) + r | 0, e += (s & r | ~s & t) + a[3] - 1044525330 | 0, e = (e << 22 | e >>> 10) + s | 0, t += (e & s | ~e & r) + a[4] - 176418897 | 0, t = (t << 7 | t >>> 25) + e | 0, r += (t & e | ~t & s) + a[5] + 1200080426 | 0, r = (r << 12 | r >>> 20) + t | 0, s += (r & t | ~r & e) + a[6] - 1473231341 | 0, s = (s << 17 | s >>> 15) + r | 0, e += (s & r | ~s & t) + a[7] - 45705983 | 0, e = (e << 22 | e >>> 10) + s | 0, t += (e & s | ~e & r) + a[8] + 1770035416 | 0, t = (t << 7 | t >>> 25) + e | 0, r += (t & e | ~t & s) + a[9] - 1958414417 | 0, r = (r << 12 | r >>> 20) + t | 0, s += (r & t | ~r & e) + a[10] - 42063 | 0, s = (s << 17 | s >>> 15) + r | 0, e += (s & r | ~s & t) + a[11] - 1990404162 | 0, e = (e << 22 | e >>> 10) + s | 0, t += (e & s | ~e & r) + a[12] + 1804603682 | 0, t = (t << 7 | t >>> 25) + e | 0, r += (t & e | ~t & s) + a[13] - 40341101 | 0, r = (r << 12 | r >>> 20) + t | 0, s += (r & t | ~r & e) + a[14] - 1502002290 | 0, s = (s << 17 | s >>> 15) + r | 0, e += (s & r | ~s & t) + a[15] + 1236535329 | 0, e = (e << 22 | e >>> 10) + s | 0, t += (e & r | s & ~r) + a[1] - 165796510 | 0, t = (t << 5 | t >>> 27) + e | 0, r += (t & s | e & ~s) + a[6] - 1069501632 | 0, r = (r << 9 | r >>> 23) + t | 0, s += (r & e | t & ~e) + a[11] + 643717713 | 0, s = (s << 14 | s >>> 18) + r | 0, e += (s & t | r & ~t) + a[0] - 373897302 | 0, e = (e << 20 | e >>> 12) + s | 0, t += (e & r | s & ~r) + a[5] - 701558691 | 0, t = (t << 5 | t >>> 27) + e | 0, r += (t & s | e & ~s) + a[10] + 38016083 | 0, r = (r << 9 | r >>> 23) + t | 0, s += (r & e | t & ~e) + a[15] - 660478335 | 0, s = (s << 14 | s >>> 18) + r | 0, e += (s & t | r & ~t) + a[4] - 405537848 | 0, e = (e << 20 | e >>> 12) + s | 0, t += (e & r | s & ~r) + a[9] + 568446438 | 0, t = (t << 5 | t >>> 27) + e | 0, r += (t & s | e & ~s) + a[14] - 1019803690 | 0, r = (r << 9 | r >>> 23) + t | 0, s += (r & e | t & ~e) + a[3] - 187363961 | 0, s = (s << 14 | s >>> 18) + r | 0, e += (s & t | r & ~t) + a[8] + 1163531501 | 0, e = (e << 20 | e >>> 12) + s | 0, t += (e & r | s & ~r) + a[13] - 1444681467 | 0, t = (t << 5 | t >>> 27) + e | 0, r += (t & s | e & ~s) + a[2] - 51403784 | 0, r = (r << 9 | r >>> 23) + t | 0, s += (r & e | t & ~e) + a[7] + 1735328473 | 0, s = (s << 14 | s >>> 18) + r | 0, e += (s & t | r & ~t) + a[12] - 1926607734 | 0, e = (e << 20 | e >>> 12) + s | 0, t += (e ^ s ^ r) + a[5] - 378558 | 0, t = (t << 4 | t >>> 28) + e | 0, r += (t ^ e ^ s) + a[8] - 2022574463 | 0, r = (r << 11 | r >>> 21) + t | 0, s += (r ^ t ^ e) + a[11] + 1839030562 | 0, s = (s << 16 | s >>> 16) + r | 0, e += (s ^ r ^ t) + a[14] - 35309556 | 0, e = (e << 23 | e >>> 9) + s | 0, t += (e ^ s ^ r) + a[1] - 1530992060 | 0, t = (t << 4 | t >>> 28) + e | 0, r += (t ^ e ^ s) + a[4] + 1272893353 | 0, r = (r << 11 | r >>> 21) + t | 0, s += (r ^ t ^ e) + a[7] - 155497632 | 0, s = (s << 16 | s >>> 16) + r | 0, e += (s ^ r ^ t) + a[10] - 1094730640 | 0, e = (e << 23 | e >>> 9) + s | 0, t += (e ^ s ^ r) + a[13] + 681279174 | 0, t = (t << 4 | t >>> 28) + e | 0, r += (t ^ e ^ s) + a[0] - 358537222 | 0, r = (r << 11 | r >>> 21) + t | 0, s += (r ^ t ^ e) + a[3] - 722521979 | 0, s = (s << 16 | s >>> 16) + r | 0, e += (s ^ r ^ t) + a[6] + 76029189 | 0, e = (e << 23 | e >>> 9) + s | 0, t += (e ^ s ^ r) + a[9] - 640364487 | 0, t = (t << 4 | t >>> 28) + e | 0, r += (t ^ e ^ s) + a[12] - 421815835 | 0, r = (r << 11 | r >>> 21) + t | 0, s += (r ^ t ^ e) + a[15] + 530742520 | 0, s = (s << 16 | s >>> 16) + r | 0, e += (s ^ r ^ t) + a[2] - 995338651 | 0, e = (e << 23 | e >>> 9) + s | 0, t += (s ^ (e | ~r)) + a[0] - 198630844 | 0, t = (t << 6 | t >>> 26) + e | 0, r += (e ^ (t | ~s)) + a[7] + 1126891415 | 0, r = (r << 10 | r >>> 22) + t | 0, s += (t ^ (r | ~e)) + a[14] - 1416354905 | 0, s = (s << 15 | s >>> 17) + r | 0, e += (r ^ (s | ~t)) + a[5] - 57434055 | 0, e = (e << 21 | e >>> 11) + s | 0, t += (s ^ (e | ~r)) + a[12] + 1700485571 | 0, t = (t << 6 | t >>> 26) + e | 0, r += (e ^ (t | ~s)) + a[3] - 1894986606 | 0, r = (r << 10 | r >>> 22) + t | 0, s += (t ^ (r | ~e)) + a[10] - 1051523 | 0, s = (s << 15 | s >>> 17) + r | 0, e += (r ^ (s | ~t)) + a[1] - 2054922799 | 0, e = (e << 21 | e >>> 11) + s | 0, t += (s ^ (e | ~r)) + a[8] + 1873313359 | 0, t = (t << 6 | t >>> 26) + e | 0, r += (e ^ (t | ~s)) + a[15] - 30611744 | 0, r = (r << 10 | r >>> 22) + t | 0, s += (t ^ (r | ~e)) + a[6] - 1560198380 | 0, s = (s << 15 | s >>> 17) + r | 0, e += (r ^ (s | ~t)) + a[13] + 1309151649 | 0, e = (e << 21 | e >>> 11) + s | 0, t += (s ^ (e | ~r)) + a[4] - 145523070 | 0, t = (t << 6 | t >>> 26) + e | 0, r += (e ^ (t | ~s)) + a[11] - 1120210379 | 0, r = (r << 10 | r >>> 22) + t | 0, s += (t ^ (r | ~e)) + a[2] + 718787259 | 0, s = (s << 15 | s >>> 17) + r | 0, e += (r ^ (s | ~t)) + a[9] - 343485551 | 0, e = (e << 21 | e >>> 11) + s | 0, i[0] = t + i[0] | 0, i[1] = e + i[1] | 0, i[2] = s + i[2] | 0, i[3] = r + i[3] | 0;
  }
  /**
   * Initialise buffer to be hashed
   */
  start() {
    return this._dataLength = 0, this._bufferLength = 0, this._state.set(_h.stateIdentity), this;
  }
  // Char to code point to to array conversion:
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/charCodeAt
  // #Example.3A_Fixing_charCodeAt_to_handle_non-Basic-Multilingual-Plane_characters_if_their_presence_earlier_in_the_string_is_unknown
  /**
   * Append a UTF-8 string to the hash buffer
   * @param str String to append
   */
  appendStr(i) {
    const a = this._buffer8, t = this._buffer32;
    let e = this._bufferLength, s, r;
    for (r = 0; r < i.length; r += 1) {
      if (s = i.charCodeAt(r), s < 128)
        a[e++] = s;
      else if (s < 2048)
        a[e++] = (s >>> 6) + 192, a[e++] = s & 63 | 128;
      else if (s < 55296 || s > 56319)
        a[e++] = (s >>> 12) + 224, a[e++] = s >>> 6 & 63 | 128, a[e++] = s & 63 | 128;
      else {
        if (s = (s - 55296) * 1024 + (i.charCodeAt(++r) - 56320) + 65536, s > 1114111)
          throw new Error(
            "Unicode standard supports code points up to U+10FFFF"
          );
        a[e++] = (s >>> 18) + 240, a[e++] = s >>> 12 & 63 | 128, a[e++] = s >>> 6 & 63 | 128, a[e++] = s & 63 | 128;
      }
      e >= 64 && (this._dataLength += 64, _h._md5cycle(this._state, t), e -= 64, t[0] = t[16]);
    }
    return this._bufferLength = e, this;
  }
  /**
   * Append an ASCII string to the hash buffer
   * @param str String to append
   */
  appendAsciiStr(i) {
    const a = this._buffer8, t = this._buffer32;
    let e = this._bufferLength, s, r = 0;
    for (; ; ) {
      for (s = Math.min(i.length - r, 64 - e); s--; )
        a[e++] = i.charCodeAt(r++);
      if (e < 64)
        break;
      this._dataLength += 64, _h._md5cycle(this._state, t), e = 0;
    }
    return this._bufferLength = e, this;
  }
  /**
   * Append a byte array to the hash buffer
   * @param input array to append
   */
  appendByteArray(i) {
    const a = this._buffer8, t = this._buffer32;
    let e = this._bufferLength, s, r = 0;
    for (; ; ) {
      for (s = Math.min(i.length - r, 64 - e); s--; )
        a[e++] = i[r++];
      if (e < 64)
        break;
      this._dataLength += 64, _h._md5cycle(this._state, t), e = 0;
    }
    return this._bufferLength = e, this;
  }
  /**
   * Get the state of the hash buffer
   */
  getState() {
    const i = this._state;
    return {
      buffer: String.fromCharCode.apply(null, Array.from(this._buffer8)),
      buflen: this._bufferLength,
      length: this._dataLength,
      state: [i[0], i[1], i[2], i[3]]
    };
  }
  /**
   * Override the current state of the hash buffer
   * @param state New hash buffer state
   */
  setState(i) {
    const a = i.buffer, t = i.state, e = this._state;
    let s;
    for (this._dataLength = i.length, this._bufferLength = i.buflen, e[0] = t[0], e[1] = t[1], e[2] = t[2], e[3] = t[3], s = 0; s < a.length; s += 1)
      this._buffer8[s] = a.charCodeAt(s);
  }
  /**
   * Hash the current state of the hash buffer and return the result
   * @param raw Whether to return the value as an `Int32Array`
   */
  end(i = false) {
    const a = this._bufferLength, t = this._buffer8, e = this._buffer32, s = (a >> 2) + 1;
    this._dataLength += a;
    const r = this._dataLength * 8;
    if (t[a] = 128, t[a + 1] = t[a + 2] = t[a + 3] = 0, e.set(_h.buffer32Identity.subarray(s), s), a > 55 && (_h._md5cycle(this._state, e), e.set(_h.buffer32Identity)), r <= 4294967295)
      e[14] = r;
    else {
      const n = r.toString(16).match(/(.*?)(.{0,8})$/);
      if (n === null) return i ? c : "";
      const o = parseInt(n[2], 16), _ = parseInt(n[1], 16) || 0;
      e[14] = o, e[15] = _;
    }
    return _h._md5cycle(this._state, e), i ? this._state : _h._hex(this._state);
  }
};
// Private Static Variables
__publicField(_h, "stateIdentity", new Int32Array([
  1732584193,
  -271733879,
  -1732584194,
  271733878
]));
__publicField(_h, "buffer32Identity", new Int32Array([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
]));
__publicField(_h, "hexChars", "0123456789abcdef");
__publicField(_h, "hexOut", []);
// Permanent instance is to use for one-call hashing
__publicField(_h, "onePassHasher", new _h());
let h = _h;
if (h.hashStr("hello") !== "5d41402abc4b2a76b9719d911017c592")
  throw new Error("Md5 self test failed.");
const __dirname$1 = path.dirname(url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.cjs", document.baseURI).href));
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "hepta-media",
    privileges: { bypassCSP: true, stream: true, supportFetchAPI: false }
  }
]);
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#f4f4f5",
      symbolColor: "#18181b",
      height: 28
    }
  });
  createMenu(mainWindow);
  registerClipperHandlers();
  mainWindow.webContents.openDevTools();
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
}
electron.app.whenReady().then(() => {
  electron.protocol.handle("hepta-media", async (request) => {
    var _a;
    try {
      const url2 = new URL(request.url);
      const filename = decodeURIComponent(url2.pathname.replace(/^\/+/, ""));
      const workspacePath = url2.searchParams.get("workspace") || "";
      const filePath = path.join(workspacePath, "media", filename);
      const data = await promises.readFile(filePath);
      const ext = ((_a = filename.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "jpg";
      const mimeMap = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
        svg: "image/svg+xml",
        avif: "image/avif"
      };
      return new Response(data, {
        headers: { "content-type": mimeMap[ext] || "application/octet-stream" }
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  createWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
electron.ipcMain.handle("fs:readFile", async (_event, path2) => {
  const fs = await import("fs/promises");
  return await fs.readFile(path2);
});
electron.ipcMain.handle("fs:writeFile", async (_event, filePath, data) => {
  console.log("[IPC] writeFile:", filePath, "data length:", data == null ? void 0 : data.length);
  const fs = await import("fs/promises");
  await fs.writeFile(filePath, data);
});
electron.ipcMain.handle("fs:deleteFile", async (_event, path2) => {
  const fs = await import("fs/promises");
  await fs.unlink(path2);
});
electron.ipcMain.handle("fs:readdir", async (_event, path2) => {
  const fs = await import("fs/promises");
  return await fs.readdir(path2);
});
electron.ipcMain.handle("fs:mkdir", async (_event, path2) => {
  const fs = await import("fs/promises");
  await fs.mkdir(path2, { recursive: true });
});
electron.ipcMain.handle("fs:stat", async (_event, path2) => {
  const fs = await import("fs/promises");
  const st = await fs.stat(path2);
  return { isDirectory: st.isDirectory(), size: st.size, mtimeMs: st.mtimeMs };
});
electron.ipcMain.handle("fs:exists", async (_event, filePath) => {
  console.log("[IPC] exists:", filePath);
  const fs = await import("fs/promises");
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});
electron.ipcMain.handle("fs:rename", async (_event, oldPath, newPath) => {
  const fs = await import("fs/promises");
  await fs.rename(oldPath, newPath);
});
electron.ipcMain.handle("fs:rmdir", async (_event, path2) => {
  const fs = await import("fs/promises");
  await fs.rm(path2, { recursive: true, force: true });
});
electron.ipcMain.handle("dialog:openDirectory", async () => {
  if (!mainWindow) return null;
  const result = await electron.dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});
const FLOMO_SIGN_KEY = "dbbc3dd73364b4084c3a69346e0ce2b2";
function signFlomoParams(params) {
  const keys = Object.keys(params).sort();
  let str = "";
  for (const k of keys) {
    const v = params[k];
    if (v === void 0 || v === null || v === "") continue;
    if (Array.isArray(v)) {
      const sorted = [...v].sort();
      for (const item of sorted) str += `${k}[]=${item}&`;
    } else {
      str += `${k}=${v}&`;
    }
  }
  str = str.slice(0, -1);
  return h.hashStr(str + FLOMO_SIGN_KEY);
}
electron.ipcMain.handle("flomo:login", async (_event, { email, password }) => {
  const ts = String(Math.floor(Date.now() / 1e3));
  const params = {
    api_key: "flomo_web",
    app_version: "2.0",
    email,
    password,
    timestamp: ts,
    webp: "1"
  };
  params.sign = signFlomoParams(params);
  const resp = await fetch("https://flomoapp.com/api/v1/user/login_by_email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(data.message || "登录失败");
  }
  return { accessToken: data.data.access_token };
});
electron.ipcMain.handle("flomo:fetchMemos", async (_event, { accessToken, lastSyncTime }) => {
  const allMemos = [];
  let latestSlug = "";
  let latestUpdatedAt = lastSyncTime || "";
  while (true) {
    const ts = String(Math.floor(Date.now() / 1e3));
    const params = {
      api_key: "flomo_web",
      app_version: "2.0",
      limit: "200",
      timestamp: ts,
      tz: "8:0",
      webp: "1"
    };
    if (latestSlug) {
      params.latest_slug = latestSlug;
      params.latest_updated_at = latestUpdatedAt;
    }
    params.sign = signFlomoParams(params);
    const url2 = `https://flomoapp.com/api/v1/memo/updated?${new URLSearchParams(params).toString()}`;
    const resp = await fetch(url2, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await resp.json();
    if (data.code === -10) throw new Error("TOKEN_EXPIRED");
    if (data.code !== 0) throw new Error(data.message || "获取 memo 失败");
    const records = data.data || [];
    allMemos.push(...records);
    if (records.length < 200) break;
    const last = records[records.length - 1];
    latestSlug = last.slug;
    latestUpdatedAt = last.updated_at;
  }
  return { memos: allMemos };
});
electron.ipcMain.handle("flomo:downloadImg", async (_event, { url: url2, destPath }) => {
  try {
    const resp = await fetch(url2);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    await promises.mkdir(path.dirname(destPath), { recursive: true });
    await promises.writeFile(destPath, buffer);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
