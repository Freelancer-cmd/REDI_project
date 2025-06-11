import json
from statistics import mean

# 1️⃣ Load ground truth (prompt → correct tool)
with open("promptToTool.json") as f:
    prompt_to_tool = json.load(f)
# 2️⃣ Load model predictions (model → {prompt → predicted tool})
with open("model_tool_selection_results.json") as f:
    model_results = json.load(f)

# 3️⃣ Prepare the list of all prompts (same order for every model)
prompts = list(prompt_to_tool.keys())

metrics = []
for model, preds in model_results.items():
    # build true/pred lists
    true_labels = [prompt_to_tool[p] for p in prompts]
    pred_labels = [preds.get(p, None)      for p in prompts]

    # accuracy
    accuracy = sum(t == p for t, p in zip(true_labels, pred_labels)) / len(prompts)

    # for macro‑averaging over classes:
    classes = set(true_labels) | set(pred_labels)
    precision_per_class = []
    recall_per_class    = []
    f1_per_class        = []

    for cls in classes:
        tp = sum((pl == cls and tl == cls)
                 for pl, tl in zip(pred_labels, true_labels))
        fp = sum((pl == cls and tl != cls)
                 for pl, tl in zip(pred_labels, true_labels))
        fn = sum((pl != cls and tl == cls)
                 for pl, tl in zip(pred_labels, true_labels))

        prec = tp/(tp+fp) if (tp+fp) > 0 else 0.0
        rec  = tp/(tp+fn) if (tp+fn) > 0 else 0.0
        f1   = (2*prec*rec/(prec+rec)) if (prec+rec) > 0 else 0.0

        precision_per_class.append(prec)
        recall_per_class.append(rec)
        f1_per_class.append(f1)

    metrics.append({
        "model":     model,
        "accuracy":  round(accuracy, 4),
        "precision": round(mean(precision_per_class), 4),
        "recall":    round(mean(recall_per_class), 4),
        "f1":        round(mean(f1_per_class), 4),
    })

# 4️⃣ Print the raw list of dicts
import pprint; pprint.pprint(metrics)
