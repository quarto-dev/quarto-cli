using Weave

Weave.register_format!("foo", Weave.WeaveHTML())

Weave.weave("FIR_design.jmd", "foo")

doc = WeaveDoc(source, informat)

doc = run_doc(
    doc;
    doctype=doctype,
    mod=mod,
    out_path=out_path,
    args=args,
    fig_path=fig_path,
    fig_ext=fig_ext,
    cache_path=cache_path,
    cache=cache,
)



# doc.chunks foreach render_chunk

