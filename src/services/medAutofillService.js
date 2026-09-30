// The controller accepts the existing model API; it owns no editable model.
export function createMedRequest(model, taskKey, rows = null) {
    return { snapshot:model, taskKey, rows:rows ? [...rows] : null };
}
export function medRequestIsCurrent(request, model, taskKey) {
    return Boolean(request && request.snapshot===model && request.taskKey===taskKey);
}
// Row components retain their identity during cell edits. A structural change
// or table replacement invalidates the old block numbers without invalidating
// navigation after each ordinary correction. These tokens are never serialized.
export function medRequestCanNavigate(request, model, taskKey, rows = null) {
    if (!request || request.taskKey!==taskKey) return false;
    if (!request.rows) return request.snapshot===model;
    return Boolean(rows && request.rows.length===rows.length
        && request.rows.every((row,i)=>row===rows[i]));
}
export function applyMedResult({request,result,modelService,schema,taskKey}) {
    const model=modelService.getModel();
    if (!medRequestIsCurrent(request,model,taskKey)) throw new Error("Результат устарел. Повторите анализ MED.");
    if (!result || result.errors.length) throw new Error("MED не изменён: анализ содержит ошибки.");
    if (!result.changes.length) return false;
    const changed=new Set(result.changes.map(c=>c.block));
    const records=model.elements.map((row,i)=> {
        if (!changed.has(i+1)) return row;
        const proposed=result.faces.filter(f=>f.block===i+1).sort((a,b)=>a.face-b.face);
        if (proposed.length!==6 || proposed.some((f,j)=>f.face!==j || !Number.isInteger(f.proposed) || f.proposed< -1)) {
            throw new Error("Неполный результат анализа. MED не изменён.");
        }
        return {...row,med:proposed.map(f=>[f.proposed])};
    });
    // One immutable publication => one history item, one table refresh, dirty
    // tracking by the established model service. Validation is run by App.
    modelService.setModelPart(schema,records,{recordHistory:true});
    return true;
}
