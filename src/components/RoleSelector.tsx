import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Character } from '../utils/storage';

interface Props {
  characters: Character[];
  selectedId: string | null;
  onSelect: (character: Character) => void;
  onManage: () => void;
}

export default function RoleSelector({ characters, selectedId, onSelect, onManage }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {characters.map(char => (
          <TouchableOpacity
            key={char.id}
            style={[styles.chip, selectedId === char.id && styles.chipActive]}
            onPress={() => onSelect(char)}>
            <Text style={[styles.chipText, selectedId === char.id && styles.chipTextActive]}>
              {char.name}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addChip} onPress={onManage}>
          <Text style={styles.addText}>+ 管理</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E9ECEF',
    marginHorizontal: 4,
  },
  chipActive: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#495057',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  addChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CED4DA',
    borderStyle: 'dashed',
    marginHorizontal: 4,
  },
  addText: {
    fontSize: 14,
    color: '#6C757D',
  },
});
