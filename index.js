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
    return list.map(it => resolve(dir, it))
  } catch (err) {
    console.log(err)
    return []
  }
}

let options = {
  isMiniApp: false, // 是否小程序
  configFile: '' // 配置文件路径
}

class AutoPath {
  provideCompletionItems(doc, pos) {
    var currDir = dirname(doc.fileName)
    var inputTxt = doc.getText(doc.lineAt(pos).range)
    var list = []
    var currDirFixed = currDir

    inputTxt = inputTxt.replace(/^['"]/, '').replace(/['"]$/, '')
    currDirFixed = join(currDir, inputTxt)

    if (inputTxt.startsWith('./')) {
      list.push(...ls(currDirFixed))
    } else {
      currDirFixed = join(options.workspace, inputTxt)
      list.push(...ls(currDirFixed))
    }

    list = list.map(k => {
      let t = isdir(k) ? FOLDER : FILE
      k = k.slice(currDirFixed.length)
      return new vsc.CompletionItem(k, t)
    })
    list.unshift(new vsc.CompletionItem('', FILE))

    return Promise.resolve(list)
  }
}

function __init__() {
  let folders = vsc.workspace.workspaceFolders

  if (folders && folders.length) {
    options.workspace = folders[0].uri.path
  } else {
    options.workspace = '/opt/www/web/small-world/'
  }

  if (options.workspace) {
    try {
      if (isfile(join(options.workspace, 'app.json'))) {
        let conf = require(join(options.workspace, 'app.json'))
        options.list = conf.pages || []
        console.log('可能是小程序', conf)
      }
    } catch (e) {
      console.log(e)
    }
  }
  console.log(options, folders)
}

exports.activate = function(ctx) {
  __init__()

  vsc.languages.getLanguages().then(function(data) {
    // return console.log(data)
  })
  let ap = new AutoPath()
  let auto = vsc.languages.registerCompletionItemProvider('*', ap, '"', "'", '/')

  ctx.subscriptions.push(auto)
}

function deactivate() {}
exports.deactivate = deactivate
