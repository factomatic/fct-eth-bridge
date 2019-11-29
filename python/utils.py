import hashlib


def compute_merkle_root(leaves, hash_f=hashlib.sha256):
    if len(leaves) == 1:
        return leaves[0]

    next_level = []

    for i in range(0, len(leaves), 2):
        val_1 = leaves[i]
        val_2 = leaves[i+1] if i+1 != len(leaves) else leaves[i]
        next_level.append(hash_f(val_1 + val_2).digest())

    return compute_merkle_root(next_level)


def build_merkle_tree(leaves, hash_f=hashlib.sha256):
    if len(leaves[-1]) == 0 or len(leaves[-1]) == 1:
        return leaves

    next_level = []
    for i in range(0, len(leaves[-1]), 2):
        left = leaves[-1][i]
        right = leaves[-1][i + 1] if i + 1 != len(leaves[-1]) else left
        top = hash_f(left + right).digest()
        next_level.append(top)

    leaves.append(next_level)
    return build_merkle_tree(leaves)


def compute_merkle_path(index, tree, path=None):
    if len(tree) == 0 or len(tree) == 1:
        return path

    if path is None:
        path = []

    if index % 2 == 1:
        path.append((tree[0][index - 1], index % 2))
    else:
        if len(tree[0]) == index + 1:
            path.append((tree[0][index], index % 2))
        else:
            path.append((tree[0][index + 1], index % 2))
    return compute_merkle_path(index // 2, tree[1:], path)


def build_merkle_path_from_anchors(anchors):
    path = []
    left, right = 1, 0
    merkle_branch = anchors['ethereum']['merklebranch']
    current = anchors['directoryblockkeymr']
    for entry in merkle_branch:
        if entry['left'] == current:
            path.append((bytes.fromhex(entry['right']), right))
        else:
            path.append((bytes.fromhex(entry['left']), left))
        current = entry['top']
    return path


def factoid_block_body_leaves(factoid_block):
    leaves = []
    for transactions in factoid_block.body.transactions.values():
        for tx in transactions:
            leaves.append(tx.hash)
        minute_marker = hashlib.sha256(b"\x00").digest()
        leaves.append(minute_marker)
    return leaves
