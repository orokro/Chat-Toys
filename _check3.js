const fs=require('fs');const {parse,compileScript,compileTemplate}=require('@vue/compiler-sfc');
const files=['src/renderer/toys/Danmaku/DanmakuWidget.vue','src/renderer/toys/Danmaku/DanmakuPage.vue','src/renderer/components/options/TextSettingsModal.vue'];
let bad=false;
for(const f of files){const src=fs.readFileSync(f,'utf8');const {descriptor,errors}=parse(src,{filename:f});
 if(errors&&errors.length){console.log('PARSE FAIL',f,errors[0].message);bad=true;continue;}
 const id='x'+Math.random().toString(36).slice(2);
 try{if(descriptor.scriptSetup||descriptor.script)compileScript(descriptor,{id});
  if(descriptor.template){const r=compileTemplate({source:descriptor.template.content,filename:f,id,compilerOptions:{mode:'module'}});if(r.errors&&r.errors.length){console.log('TPL FAIL',f,r.errors[0]);bad=true;continue;}}
  console.log('OK  ',f);}catch(e){console.log('COMPILE FAIL',f,e.message);bad=true;}}
process.exit(bad?1:0);
