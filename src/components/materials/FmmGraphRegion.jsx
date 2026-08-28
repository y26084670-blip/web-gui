export function FmmGraphRegion(props) {
  const count = () => props.records?.length ?? 0;

  return (
    <section
      class="fmm-graph-region"
      aria-label="Область графиков характеристик ФММ"
    >
      <div class="fmm-graph-region-title">
        Графики характеристик ФММ
      </div>
      <div class="fmm-graph-region-host">
        {count() > 0
          ? `Выбрано характеристик: ${count()}`
          : "Выберите характеристики в таблице"}
      </div>
    </section>
  );
}
