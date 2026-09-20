export function medBox({origin=[0,0,0],size=[1,1,1],dp=[1,1,1],med=Array(6).fill(-1),...rest}={}) {
    return {name:"ШГ",geoType:0,geo:Array.from({length:8},(_,i)=>origin.map((o,d)=>o+((i>>d)&1)*size[d])),
        dr:[[0],[0],[0]],symVi:[[0],[0],[0]],symR0:[[0],[0],[0]],
        dp:dp.map(x=>[x]),med:med.map(x=>[x]),targ:0,rv:1,model:0,
        symLs:1,symAs:1,symPs:1,symYl:0,symYa:0,symTx:0,symKya:0,symKyp:0,indMove:0,...rest};
}
export function medModel(elements, general={}) {
    return {general:{doubleFloat:true,mirrorSymmetryX:-1,mirrorSymmetryY:-1,countTimeSteps:0,timeStep:0,...general},elements,moves:[]};
}
// Independent expected topology is expressed as original block/face numbers.
export function medContactCases() {
    return [
        {name:"minus-minus",model:medModel([medBox(),medBox({origin:[1,0,0]})]),contacts:1},
        {name:"free",model:medModel([medBox()]),contacts:0},
        {name:"edge",model:medModel([medBox(),medBox({origin:[1,1,0]})]),contacts:0},
        {name:"vertex",model:medModel([medBox(),medBox({origin:[1,1,1]})]),contacts:0},
        {name:"partial",model:medModel([medBox(),medBox({origin:[1,.5,.25]})]),error:"PARTIAL_CONTACT"},
        {name:"nested-face",model:medModel([medBox(),medBox({origin:[1,.25,.25],size:[1,.5,.5]})]),error:"PARTIAL_CONTACT"},
        {name:"overlap",model:medModel([medBox(),medBox({origin:[.5,0,0]})]),error:"VOLUME_OVERLAP"},
        {name:"duplicate",model:medModel([medBox(),medBox()]),error:"VOLUME_OVERLAP"},
        {name:"grid-mismatch",model:medModel([medBox({dp:[1,2,3]}),medBox({origin:[1,0,0],dp:[1,3,2]})]),error:"GRID_MISMATCH"},
        {name:"normal-dp",model:medModel([medBox({dp:[2,2,3]}),medBox({origin:[1,0,0],dp:[5,2,3]})]),contacts:1},
        {name:"mirror",model:medModel([medBox()],{mirrorSymmetryX:0}),contacts:1},
        {name:"periodic-conflict",model:medModel([medBox({symPs:2,symTx:1})]),error:"IMAGE_CONFLICT"},
        {name:"material-contact",model:medModel([medBox({model:2}),medBox({origin:[1,0,0],model:0})]),contacts:1},
    ];
}
