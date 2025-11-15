
const grid=document.getElementById("grid");
function buildGrid(){
  grid.innerHTML="";
  for(let i=0;i<25;i++){
    let c=document.createElement("div");
    c.className="cell";
    grid.appendChild(c);
  }
}
buildGrid();
