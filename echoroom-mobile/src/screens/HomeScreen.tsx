import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>EchoRoom</Text>
      <Text style={styles.subtitle}>AI Social Chaos Platform</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0b",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#06b6d4",
  },
  subtitle: {
    fontSize: 16,
    color: "#a1a1aa",
    marginTop: 8,
  },
});
