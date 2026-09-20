using Test, LinearAlgebra
length(ARGS)==2 || error("Expected solver checkout and generated cases.jl")
const SOLVER_ROOT=abspath(ARGS[1])
include(joinpath(SOLVER_ROOT,"test","support","current_weak_fixture.jl"))
include(abspath(ARGS[2]))

function check_case(m,c)
    T=m.REAL
    task=m.TaskData()
    task.general.mirrorSymmetryX=c["general"]["mirrorSymmetryX"]
    task.general.mirrorSymmetryY=c["general"]["mirrorSymmetryY"]
    for move in c["moves"]
        push!(task.moves,m.Move(angle=permutedims(hcat([T.(row) for row in move["angle"]]...)),
            position=permutedims(hcat([T.(row) for row in move["position"]]...))))
    end
    for row in c["kvs"]
        kv=m.cube(targ=row["targ"],rv=row["rv"]>0,model=row["model"])
        kv.self.geoType=row["geoType"]
        kv.self.geo=T.(reduce(vcat,row["geo"]))
        kv.self.dr=T.(row["dr"]);kv.self.dp=Int.(row["dp"])
        kv.self.rv=T(row["rv"]);kv.self.med=Int.(row["med"])
        kv.self.indMove=row["indMove"]
        sym=row["sym"]
        for k in ("ls","as","ps","kya","kyp")
            setproperty!(kv.self.sym,Symbol(k),Int(sym[k]))
        end
        for k in ("yl","ya","tx")
            setproperty!(kv.self.sym,Symbol(k),T(sym[k]))
        end
        kv.self.sym.vi=T.(sym["vi"]);kv.self.sym.r0=T.(sym["r0"])
        m.update_sym(kv.self.sym,kv.sym)
        m.update_sym(kv.self.sym,kv.sym,zeros(T,3),zeros(T,3))
        @test m.unpack(kv)==0
        push!(task.kvs,kv)
    end
    m.evalCounters(task)
    m.moveRecall(task,0)
    topology=m.buildCurrentTopology(task)
    space,cells=m.weakCurrentSpace(task)
    @test length(cells)==length(topology.cells)
    @test all(isfinite,space.c.nzval)
    @test all(>(0),space.weights)
    # Every free external face must stay insulating in the production topology.
    for (i,cell) in enumerate(cells), f in 1:6
        if cell.boundary[f] && task.kvs[cell.block].self.med[f]==-1
            @test topology.faces[f,i]==0
        end
    end
    insulated=deepcopy(task)
    for kv in insulated.kvs;kv.self.med .= -1;end
    separate=m.weakCurrentSpace(insulated)[1]
    if c["contacts"]>0
        @test size(space.c,1)<size(separate.c,1)
        # Destroy exactly one side of a valid pointer: production must reject it.
        broken=deepcopy(task)
        pointer=findfirst(kv->any(>(0),kv.self.med),broken.kvs)
        if !isnothing(pointer)
            f=findfirst(>(0),broken.kvs[pointer].self.med)
            broken.kvs[pointer].self.med[f]=-1
            @test_throws ErrorException m.weakCurrentSpace(broken)
        end
    else
        @test size(space.c)==size(separate.c)
    end
end

@testset "web-gui MED / existing solver weak space" begin
    for T in (Float32,Float64)
        m=CurrentWeakTests.fixture(T)
        Base.include(m,joinpath(SOLVER_ROOT,"src","base","04_symmetry.jl"))
        Base.include(m,joinpath(SOLVER_ROOT,"src","base","04_approx.jl"))
        Base.include(m,joinpath(SOLVER_ROOT,"src","task","02_moves.jl"))
        for c in MED_CASES
            c["doubleFloat"]==(T===Float64) || continue
            @testset "$(c["name"]) $T" begin
                Base.invokelatest(check_case,m,c)
            end
        end
    end
end
