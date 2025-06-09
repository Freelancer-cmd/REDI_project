#!/usr/bin/env python3
"""
Plot tool performance by prompt length from output_stats file.

Creates a grouped bar chart showing each tool's average score over
LONG, MEDIUM, and SHORT prompt variants.
"""

import os
import sys



def parse_output_stats(path):
    """
    Parse the output_stats file and return the list of tool names and their per-prompt averages.
    Returns:
      class_names: List[str] of tool identifiers in order.
      blocks: List[List[float]] where each sublist is the list of averages for a prompt length.
    """
    with open(path, 'r') as f:
        lines = f.readlines()
    class_names = []
    blocks = []
    i = 0
    n = len(lines)
    while i < n:
        if lines[i].startswith('Class, Count, Average, StdDev'):
            i += 1
            names = []
            avgs = []
            while i < n and lines[i].strip() and not lines[i].startswith('System Prompt:'):
                parts = [p.strip() for p in lines[i].split(',')]
                if len(parts) >= 3:
                    name, avg_str = parts[0], parts[2]
                    try:
                        av = float(avg_str)
                    except ValueError:
                        i += 1
                        continue
                    names.append(name)
                    avgs.append(av)
                i += 1
            if not class_names:
                class_names = names
            elif names and names != class_names:
                print(f"Warning: inconsistent class order in stats block: {names}", file=sys.stderr)
            blocks.append(avgs)
        else:
            i += 1
    return class_names, blocks


def main(stats_path, prompt_labels, output_path):
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib is required. Install via 'pip install matplotlib'", file=sys.stderr)
        sys.exit(1)
    base_dir = os.path.dirname(__file__)
    stats_path = stats_path if os.path.isabs(stats_path) else os.path.join(base_dir, stats_path)
    if not os.path.exists(stats_path):
        print(f"File not found: {stats_path}", file=sys.stderr)
        sys.exit(1)
    class_names, blocks = parse_output_stats(stats_path)
    if not blocks or not class_names:
        print(f"No stats found in {stats_path}", file=sys.stderr)
        sys.exit(1)
    if prompt_labels:
        labels = prompt_labels
    else:
        labels = ['VERY_DESCRIPTIVE', 'SEMI_DESCRIPTIVE', 'NOT_DESCRIPTIVE']
        if len(blocks) != len(labels):
            print(f"Warning: expected {len(labels)} prompt blocks, found {len(blocks)}", file=sys.stderr)

    # Ensure consistent tool counts across prompt blocks
    num_tools = len(class_names)
    for blk in blocks:
        if len(blk) != num_tools:
            print(f"Error: block length {len(blk)} does not match number of tools {num_tools}", file=sys.stderr)
            sys.exit(1)

    # Plot grouped bar chart: one group per tool, bars for each prompt length
    num_blocks = len(blocks)
    x = list(range(num_tools))
    bar_width = 0.8 / num_blocks if num_blocks > 0 else 0.8
    offsets = [(- (num_blocks - 1) / 2 + i) * bar_width for i in range(num_blocks)]

    plt.figure()
    for idx, (lbl, blk) in enumerate(zip(labels, blocks)):
        positions = [pos + offsets[idx] for pos in x]
        plt.bar(positions, blk, width=bar_width, label=lbl)

    plt.xticks(x, class_names, rotation=45, ha='right')
    plt.xlabel('Tool')
    plt.ylabel('Average Score')
    plt.title('Tool Performance by Prompt Length')
    plt.legend(title='Prompt Length', loc='upper left', bbox_to_anchor=(1, 1))
    plt.tight_layout()

    output_file = output_path if os.path.isabs(output_path) else os.path.join(base_dir, output_path)
    plt.savefig(output_file, bbox_inches='tight')
    print(f"Plot saved to {output_file}")
    plt.show()


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Plot tool performance by prompt variants from an output_stats file.'
    )
    parser.add_argument(
        '-i', '--input', default='output_stats',
        help='Path to input stats file (default: output_stats).'
    )
    parser.add_argument(
        '-l', '--labels', nargs='+',
        help='Optional list of prompt labels for each stats block.'
    )
    parser.add_argument(
        '-o', '--output', default=None,
        help='Path for output plot image (default: <input>_plot.png).'
    )
    args = parser.parse_args()
    if not args.output:
        base = os.path.splitext(args.input)[0] if os.path.splitext(args.input)[1] else args.input
        out = f'{base}_plot.png'
    else:
        out = args.output
    main(args.input, args.labels, out)