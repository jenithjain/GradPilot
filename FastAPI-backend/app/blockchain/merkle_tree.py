import hashlib
from typing import List, Tuple

class MerkleTree:
    """
    A simple Merkle Tree implementation for data integrity verification.
    Used to prove that forecast data hasn't been tampered with.
    """
    
    def __init__(self, data_points: List[str]):
        """
        Initialize Merkle Tree from a list of data points.
        
        Args:
            data_points: List of strings (e.g., daily predictions)
        """
        if not data_points:
            raise ValueError("Cannot create Merkle Tree from empty data")
            
        self.leaves = [self._hash(data) for data in data_points]
        self.tree = self._build_tree(self.leaves)
        self.root = self.tree[0] if self.tree else None
    
    def _hash(self, data: str) -> str:
        """Generate SHA-256 hash of data."""
        return hashlib.sha256(data.encode()).hexdigest()
    
    def _build_tree(self, nodes: List[str]) -> List[str]:
        """Build the Merkle Tree bottom-up."""
        tree = nodes.copy()
        current_level = nodes
        
        while len(current_level) > 1:
            next_level = []
            
            # Process pairs
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                # If odd number, duplicate the last one
                right = current_level[i + 1] if i + 1 < len(current_level) else left
                parent = self._hash(left + right)
                next_level.append(parent)
                tree.append(parent)
            
            current_level = next_level
        
        return tree
    
    def get_root(self) -> str:
        """Get the Merkle Root (top hash)."""
        return self.root
    
    def get_proof(self, index: int) -> List[Tuple[str, str]]:
        """
        Get the proof path for a specific leaf (data point).
        
        Args:
            index: Index of the data point (0-based)
            
        Returns:
            List of (hash, position) tuples needed to reconstruct the root
            position is either 'left' or 'right'
        """
        if index < 0 or index >= len(self.leaves):
            raise ValueError("Index out of range")
        
        proof = []
        current_level = self.leaves
        current_index = index
        
        while len(current_level) > 1:
            # Find sibling
            if current_index % 2 == 0:  # We're on the left
                sibling_index = current_index + 1
                position = 'right'
            else:  # We're on the right
                sibling_index = current_index - 1
                position = 'left'
            
            # Get sibling hash (duplicate if it doesn't exist)
            if sibling_index < len(current_level):
                sibling = current_level[sibling_index]
            else:
                sibling = current_level[current_index]
            
            proof.append((sibling, position))
            
            # Move up to parent level
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                right = current_level[i + 1] if i + 1 < len(current_level) else left
                parent = self._hash(left + right)
                next_level.append(parent)
            
            current_level = next_level
            current_index = current_index // 2
        
        return proof
    
    def verify_proof(self, data: str, index: int, proof: List[Tuple[str, str]], root: str) -> bool:
        """
        Verify that a piece of data is part of the tree.
        
        Args:
            data: The original data point
            index: Its index in the tree
            proof: The proof path from get_proof()
            root: The expected Merkle Root
            
        Returns:
            True if the data is valid, False otherwise
        """
        current_hash = self._hash(data)
        
        for sibling_hash, position in proof:
            if position == 'left':
                current_hash = self._hash(sibling_hash + current_hash)
            else:
                current_hash = self._hash(current_hash + sibling_hash)
        
        return current_hash == root
    
    def to_dict(self):
        """Export tree structure for visualization."""
        return {
            "root": self.root,
            "leaves": self.leaves,
            "tree": self.tree,
            "size": len(self.leaves)
        }
    
    def get_hierarchical_structure(self, data_points: List[str] = None):
        """
        Convert flat tree structure into hierarchical format for frontend visualization.
        
        Returns:
            Dictionary representing the tree as nested nodes with children
        """
        if not self.leaves:
            return None
        
        # Build level-by-level structure
        levels = []
        current_level_hashes = self.leaves.copy()
        current_level_data = data_points if data_points else [f"Leaf {i}" for i in range(len(self.leaves))]
        
        # Level 0: Leaves
        levels.append([
            {
                "hash": hash_val,
                "data": current_level_data[i],
                "level": 0,
                "index": i,
                "type": "leaf"
            }
            for i, hash_val in enumerate(current_level_hashes)
        ])
        
        level_num = 1
        
        # Build intermediate levels
        while len(current_level_hashes) > 1:
            next_level = []
            next_level_hashes = []
            
            for i in range(0, len(current_level_hashes), 2):
                left_idx = i
                right_idx = i + 1 if i + 1 < len(current_level_hashes) else i
                
                left_hash = current_level_hashes[left_idx]
                right_hash = current_level_hashes[right_idx]
                parent_hash = self._hash(left_hash + right_hash)
                
                next_level_hashes.append(parent_hash)
                next_level.append({
                    "hash": parent_hash,
                    "left_child": left_hash,
                    "right_child": right_hash,
                    "level": level_num,
                    "index": len(next_level),
                    "type": "root" if len(current_level_hashes) <= 2 else "intermediate"
                })
            
            levels.append(next_level)
            current_level_hashes = next_level_hashes
            level_num += 1
        
        return {
            "root": self.root,
            "total_levels": len(levels),
            "total_leaves": len(self.leaves),
            "levels": levels
        }


# Example Usage
if __name__ == "__main__":
    # Simulate 28 days of predictions
    predictions = [f"Day {i+1}: ${1000 + i*50}" for i in range(28)]
    
    # Build tree
    tree = MerkleTree(predictions)
    print(f"Merkle Root: {tree.get_root()}")
    
    # Get proof for Day 5
    proof = tree.get_proof(4)  # 0-indexed
    print(f"\nProof for Day 5: {len(proof)} hashes needed")
    
    # Verify
    is_valid = tree.verify_proof(predictions[4], 4, proof, tree.get_root())
    print(f"Verification: {is_valid}")
    
    # Try tampering
    fake_data = "Day 5: $9999999"
    is_fake_valid = tree.verify_proof(fake_data, 4, proof, tree.get_root())
    print(f"Tampered data verification: {is_fake_valid}")
