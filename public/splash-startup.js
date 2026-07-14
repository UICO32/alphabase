var __splashSteps = ['初始化工作区', '加载卡片数据', '加载画板快照', '恢复回收站', '准备就绪']
var __splashMountTs = Date.now()
setTimeout(function () {
  document.querySelector('.sp-left')?.classList.add('entered')
  document.querySelector('.sp-right')?.classList.add('entered')
}, 150)
window.__updateSplashProgress = function (stepIndex) {
  var fill = document.getElementById('splash-fill')
  var label = document.getElementById('splash-step')
  var pct = Math.round((stepIndex / (__splashSteps.length - 1)) * 100)
  if (fill) fill.style.width = pct + '%'
  if (label) label.textContent = stepIndex >= 0 && stepIndex < __splashSteps.length ? __splashSteps[stepIndex] : ''
}
window.__dismissSplash = function () {
  var delay = Math.max(0, 2000 - (Date.now() - __splashMountTs))
  setTimeout(function () {
    var splash = document.getElementById('splash')
    if (splash) {
      splash.classList.add('fade-out')
      setTimeout(function () { splash.remove() }, 300)
    }
  }, delay)
}
