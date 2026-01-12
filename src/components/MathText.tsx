import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MathJaxSvg } from 'react-native-mathjax-html-to-svg';

interface MathTextProps {
    content: string;
    fontSize?: number;
    color?: string;
    baseStyle?: any;
}

/**
 * MathText Component (SVG-based Native Rendering)
 * Renders LaTeX formulas using MathJax SVG conversion.
 * Fully offline, no WebView, no CDN dependencies.
 */
export default function MathText({ content, fontSize = 16, color = '#333', baseStyle }: MathTextProps) {
    return (
        <View style={baseStyle}>
            <MathJaxSvg
                fontSize={fontSize}
                color={color}
                fontCache={true}
            >
                {content}
            </MathJaxSvg>
        </View>
    );
}
