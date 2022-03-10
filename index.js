/**
 *
 * @author yutent<yutent.io@gmail.com>
 * @date 2018/11/01 09:37:55
 */

const vsc = require('vscode')
const { resolve, dirname, join } = require('path')
const fs = require('fs')

const FILE = vsc.CompletionItemKind.File
const FOLDER = vsc.CompletionItemKind.Folder

/**
 * [isdir 判断目标是否为目录]
 */
function isdir(path) {
  try {
    return fs.statSync(path).isDirectory()
  } catch (err) {
    return false
  }
}

function isfile(path) {
  try {
    return fs.statSync(path).isFile()
  } catch (err) {
    return false
  }
}

/**
 * 列出目录
 */
function ls(dir) {
  try {
    var list = fs.readdirSync(dir)
    return list.filter(it => !it.startsWith('.')).map(it => resolve(dir, it))
  } catch (err) {
    return []
  }
}

function getPrefixTxt(line, idx) {
  var txt = line.slice(0, idx)
  var n = txt.lastIndexOf('"') > -1 ? txt.lastIndexOf('"') : txt.lastIndexOf("'")
  var r

  txt = txt.slice(n + 1)
  if (txt) {
    // 判断匹配前缀是否被包含在引号中
    r = new RegExp(`(['"])${txt}\\1`)

    if (r.test(line)) {
      return txt
    }
  }
  return ''
}

function item(text, type, p) {
  var _ = new vsc.CompletionItem(text, type)
  _.range = new vsc.Range(p, p)
  return _
}

let options = {
  isMiniApp: false, // 是否小程序
  workspace: resolve('./'),
  extendWorkspace: null // 额外的项目目录, 一般是 vue项目中的 src目录
}

class AutoPath {
  provideCompletionItems(doc, pos) {
    var currDir = dirname(doc.fileName)
    var inputTxt = doc.lineAt(pos).text // 获取光标所在的整行代码
    var list = []
    var currDirFixed = ''
    var inputTxtTrim = inputTxt.trim()

    // console.log('原始inputTxt >>>> ', inputTxt)

    /**
     * 过滤掉 以下几种情况
     * @1 在注释后面的
     * @2 当前光标在行末的
     * @3 匹配前缀在行首的
     */
    if (
      inputTxtTrim.startsWith('// ') ||
      inputTxtTrim.startsWith('/* ') ||
      inputTxtTrim.startsWith('# ') ||
      inputTxtTrim.startsWith('./') ||
      inputTxtTrim.startsWith('../') ||
      inputTxtTrim.startsWith('/') ||
      inputTxtTrim.length === pos.character
    ) {
      return
    }

    inputTxt = getPrefixTxt(inputTxt, pos.character)
    currDirFixed = join(currDir, inputTxt)

    // console.log('修正后的inputTxt: ', inputTxt)

    if (!inputTxt) {
      return
    }

    if (inputTxt.startsWith('./') || inputTxt.startsWith('../')) {
      list.push(...ls(currDirFixed))
    } else {
      // 小程序
      if (options.isMiniApp) {
        let conf = require(join(options.workspace, 'app.json'))

        list = conf.pages.map(it => `/${it}`)

        if (conf.subPackages && conf.subPackages.length) {
          for (let it of conf.subPackages) {
            list.push(...it.pages.map(p => '/' + it.root + p))
          }
        }

        currDirFixed = inputTxt
        list = list.filter(it => it.startsWith(inputTxt))
      }
      // vue项目
      else if (inputTxt.startsWith('@/') && options.extendWorkspace) {
        currDirFixed = join(options.extendWorkspace, inputTxt.slice(2))
        list.push(...ls(currDirFixed))
      }
      // 其他的
      else {
        currDirFixed = join(options.workspace, inputTxt)
        list.push(...ls(currDirFixed))
      }
    }

    // console.log('currDirFixed: ', options, currDirFixed, list)

    list = list
      .filter(it => it !== doc.fileName)
      .map(k => {
        let t = options.isMiniApp ? FILE : isdir(k) ? FOLDER : FILE
        k = k.slice(currDirFixed.length)
        return item(k, t, pos)
      })

    if (list.length) {
      list.unshift(item('', FILE, pos))
      return Promise.resolve(list)
    }
  }
}

function __init__() {
  let folders = vsc.workspace.workspaceFolders

  if (folders && folders.length) {
    options.workspace = folders[0].uri.path
  }

  if (options.workspace) {
    // 判断是否是小程序
    if (isfile(join(options.workspace, 'app.json'))) {
      let conf = require(join(options.workspace, 'app.json'))
      if (conf.pages && conf.pages.length) {
        options.isMiniApp = true
        return
      }
    }
    // 简单判断是否是vue项目
    if (isfile(join(options.workspace, 'package.json'))) {
      let conf = require(join(options.workspace, 'package.json'))
      if (conf.dependencies.vue) {
        let extendWorkspace = join(options.workspace, 'src/')
        if (isdir(extendWorkspace)) {
          options.extendWorkspace = extendWorkspace
        }
      }
    }
  }
}

exports.activate = function(ctx) {
  __init__()

  let ap = new AutoPath()
  let auto = vsc.languages.registerCompletionItemProvider('*', ap, '"', "'", '/')

  ctx.subscriptions.push(auto)
}

exports.deactivate = function() {}
