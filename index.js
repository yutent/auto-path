/**
 *
 * @author yutent<yutent.io@gmail.com>
 * @date 2018/11/01 09:37:55
 */

const vsc = require('vscode')
const { resolve, dirname, join } = require('path')
const fs = require('fs')

const FILE = vsc.CompletionItemKind.Text
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
    return list.map(it => resolve(dir, it))
  } catch (err) {
    return []
  }
}

function getPrefixTxt(line, idx) {
  var txt = line.slice(0, idx)
  var n = txt.lastIndexOf('"') > -1 ? txt.lastIndexOf('"') : txt.lastIndexOf("'")
  return txt.slice(n + 1)
}

function item(text, type, p) {
  var _ = new vsc.CompletionItem(text, type)
  _.range = new vsc.Range(p, p)
  return _
}

let options = {
  isMiniApp: false, // 是否小程序
  extendWorkspace: null // 额外的项目目录, 一般是 vue项目中的 src目录
}

class AutoPath {
  provideCompletionItems(doc, pos) {
    var currDir = dirname(doc.fileName)
    var inputTxt = doc.lineAt(pos).text // 获取光标所在的整行代码
    var list = []
    var currDirFixed = ''

    inputTxt = getPrefixTxt(inputTxt, pos.character)
    currDirFixed = join(currDir, inputTxt)

    if (!inputTxt) {
      return
    }

    if (inputTxt.startsWith('./')) {
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

    list = list.map(k => {
      let t = options.isMiniApp ? FILE : isdir(k) ? FOLDER : FILE
      k = k.slice(currDirFixed.length)
      return item(k, t, pos)
    })
    list.unshift(item('', FILE, pos))

    return Promise.resolve(list)
  }
}

function __init__() {
  let folders = vsc.workspace.workspaceFolders

  if (folders && folders.length) {
    options.workspace = folders[0].uri.path
  } else {
    options.workspace = '/opt/www/web/small-world'
  }

  console.log()

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
    if (
      isfile(join(options.workspace, 'vue.config.js')) ||
      isfile(join(options.workspace, 'vite.config.js'))
    ) {
      let extendWorkspace = join(options.workspace, 'src/')
      if (isdir(extendWorkspace)) {
        options.extendWorkspace = extendWorkspace
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
