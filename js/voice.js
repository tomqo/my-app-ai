// voice.js — 语音输入（Web Speech API）与语音朗读
(function (global) {
  'use strict';

  const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
  const synth = global.speechSynthesis;

  let recognition = null;
  let isListening = false;

  function isSupported() {
    return !!SR;
  }

  function startRecognition(lang, onResult, onStateChange) {
    if (!SR) {
      utils.toast('当前浏览器不支持语音识别（建议用 Chrome/Edge）', true);
      return false;
    }
    if (isListening) {
      stopRecognition();
      return true;
    }

    recognition = new SR();
    recognition.lang = lang || 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onstart = () => {
      isListening = true;
      onStateChange && onStateChange(true);
    };

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onResult && onResult(finalText, interim);
    };

    recognition.onerror = (e) => {
      isListening = false;
      onStateChange && onStateChange(false);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        utils.toast('没有麦克风权限，请在浏览器设置中允许', true);
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        utils.toast('语音识别错误：' + e.error, true);
      }
    };

    recognition.onend = () => {
      isListening = false;
      onStateChange && onStateChange(false);
      onResult && onResult(finalText, '', true);
    };

    try {
      recognition.start();
    } catch (e) {
      isListening = false;
      utils.toast('语音识别启动失败', true);
      return false;
    }
    return true;
  }

  function stopRecognition() {
    if (recognition) {
      try { recognition.stop(); } catch (e) { /* ignore */ }
    }
    isListening = false;
  }

  function speak(text, lang, enabled) {
    if (!enabled || !synth || !text) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang || 'zh-CN';
      u.rate = 1.0;
      synth.speak(u);
    } catch (e) { /* ignore */ }
  }

  function stopSpeaking() {
    if (synth) synth.cancel();
  }

  global.Voice = {
    isSupported,
    startRecognition,
    stopRecognition,
    speak,
    stopSpeaking
  };
})(window);
