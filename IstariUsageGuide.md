ISTARI: Tactic-based proof assistant for Martin-Lof type theory. IML (ML dialect) tactics manipulate LCF-style proof objects.

MCP OPS: open_document(path)→doc_id. PRIMARY: goto_line(doc_id,line) jumps+auto-rewinds context, attempt_tactic(doc_id,tactic) tries+validates+keeps/rollbacks. SECONDARY: show_current_goals(doc_id), list_constants(doc_id,module), get_type(doc_id,const), get_definition(doc_id,const), search_constants(doc_id,target).

WORKFLOW: goto_line to position → show_current_goals → attempt_tactic repeatedly until goal solved. Goto handles all context/rewinding automatically.

SYNTAX: lemma "name" /stmt/; → tactics → qed();. Subgoals: {enter}/exit}. define /n/ /body/ /type/;. definerec, typedef, reductions.

TACTICS: Intro: intro,split,left/right,exists. Elim: destruct,apply,so. Auto: auto,typecheck,rewrite.

LIBS: Preloaded: Nat,Bool,Integer,List,Logic,Function,Partial,Eventually,Quotient,Irrelevance. Load: File.load "f";.