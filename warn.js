const p=new URLSearchParams(location.search);
const u=p.get("u")||"", r=p.get("r")||"";
document.getElementById("u").textContent=u;
document.getElementById("r").textContent=r;
document.getElementById("back").onclick=()=>history.length>1?history.back():window.close();
document.getElementById("go").onclick=async()=>{
  await browser.runtime.sendMessage({allow:u});
  location.replace(u);
};
