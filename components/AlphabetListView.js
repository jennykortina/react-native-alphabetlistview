"use strict";
/* jshint esnext: true */

import React, { Component } from "react";
import PropTypes from "prop-types";
import ReactNative, {
  ListView,
  StyleSheet,
  View,
  NativeModules
} from "react-native";
import merge from "merge";

import SectionHeader from "./SectionHeader";
import SectionList from "./SectionList";
import CellWrapper from "./CellWrapper";

const { UIManager } = NativeModules;

export default class AlphabetListView extends Component {
  constructor(props, context) {
    super(props, context);

    this.state = {
      dataSource: new ListView.DataSource({
        rowHasChanged: (row1, row2) => row1 !== row2,
        sectionHeaderHasChanged: (prev, next) => prev !== next
      }),
      offsetY: 0,
      formattedData: []
    };

    this.renderFooter = this.renderFooter.bind(this);
    this.renderHeader = this.renderHeader.bind(this);
    this.renderRow = this.renderRow.bind(this);
    this.renderSectionHeader = this.renderSectionHeader.bind(this);

    this.onScroll = this.onScroll.bind(this);
    this.onScrollAnimationEnd = this.onScrollAnimationEnd.bind(this);
    this.scrollToSection = this.scrollToSection.bind(this);
    this.sortDataByField = this.sortDataByField.bind(this);

    // used for dynamic scrolling
    // always the first cell of a section keyed by section id
    this.cellTagMap = {};
    this.sectionTagMap = {};
    this.updateTagInCellMap = this.updateTagInCellMap.bind(this);
    this.updateTagInSectionMap = this.updateTagInSectionMap.bind(this);
    this.calculateTotalHeight = this.calculateTotalHeight.bind(this);
  }

  componentWillMount() {
    const { data, sortOn } = this.props;
    const formattedData = this.sortDataByField(data, sortOn);
    this.setState({ formattedData });
    this.calculateTotalHeight(formattedData);
  }

  componentDidMount() {
    // push measuring into the next tick
    setTimeout(() => {
      UIManager.measure(
        ReactNative.findNodeHandle(this.refs.view),
        (x, y, w, h) => {
          this.containerHeight = h;
        }
      );
    }, 0);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.data && nextProps.data !== this.props.data) {
      this.calculateTotalHeight(nextProps.data);
    }
  }

  calculateTotalHeight(data) {
    this.sectionItemCount = {};
    this.totalHeight = Object.keys(data).reduce((carry, key) => {
      var itemCount = data[key].length;
      carry += itemCount * this.props.cellHeight;
      carry += this.props.sectionHeaderHeight;

      this.sectionItemCount[key] = itemCount;

      return carry;
    }, 0);
  }

  updateTagInSectionMap(tag, section) {
    this.sectionTagMap[section] = tag;
  }

  updateTagInCellMap(tag, section) {
    this.cellTagMap[section] = tag;
  }

  scrollToSection(section) {
    let y = 0;
    let headerHeight = this.props.headerHeight || 0;
    y += headerHeight;

    if (!this.props.useDynamicHeights) {
      const cellHeight = this.props.cellHeight;
      let sectionHeaderHeight = this.props.sectionHeaderHeight;
      const keys = Object.keys(this.props.data);
      const index = keys.indexOf(section);

      let numcells = 0;
      for (var i = 0; i < index; i++) {
        numcells += this.props.data[keys[i]].length;
      }

      sectionHeaderHeight = index * sectionHeaderHeight;
      y += numcells * cellHeight + sectionHeaderHeight;
      const maxY = this.totalHeight - this.containerHeight + headerHeight;
      y = y > maxY ? maxY : y;

      this.refs.listview.scrollTo({ x: 0, y, animated: true });
    } else {
      // this breaks, if not all of the listview is pre-rendered!
      UIManager.measure(this.cellTagMap[section], (x, y, w, h) => {
        y = y - this.props.sectionHeaderHeight;
        this.refs.listview.scrollTo({ x: 0, y, animated: true });
      });
    }

    this.props.onScrollToSection && this.props.onScrollToSection(section);
  }

  renderSectionHeader(sectionData, sectionId) {
    const updateTag = this.props.useDynamicHeights
      ? this.updateTagInSectionMap
      : null;

    const title = this.props.getSectionTitle
      ? this.props.getSectionTitle(sectionId)
      : sectionId;

    return (
      <SectionHeader
        component={this.props.sectionHeader}
        title={title}
        sectionId={sectionId}
        sectionData={sectionData}
        updateTag={updateTag}
      />
    );
  }

  renderFooter() {
    const Footer = this.props.footer;
    return <Footer />;
  }

  renderHeader() {
    const Header = this.props.header;
    return <Header />;
  }

  renderRow(item, sectionId, index) {
    const CellComponent = this.props.cell;
    index = parseInt(index, 10);

    const isFirst = index === 0;
    const isLast = this.sectionItemCount[sectionId] - 1 === index;

    const props = {
      isFirst,
      isLast,
      sectionId,
      index,
      item,
      offsetY: this.state.offsetY,
      onSelect: this.props.onCellSelect
    };

    return index === 0 && this.props.useDynamicHeights ? (
      <CellWrapper
        updateTag={this.updateTagInCellMap}
        component={CellComponent}
        {...props}
        {...this.props.cellProps}
      />
    ) : (
      <CellComponent {...props} {...this.props.cellProps} />
    );
  }

  onScroll(e) {
    const offsetY = e.nativeEvent.contentOffset.y;
    if (this.props.updateScrollState) {
      this.setState({
        offsetY
      });
    }

    this.props.onScroll && this.props.onScroll(e);
  }

  onScrollAnimationEnd(e) {
    if (this.props.updateScrollState) {
      this.setState({
        offsetY: e.nativeEvent.contentOffset.y
      });
    }
  }

  sortDataByField(dataArray, field) {
    let data = {};
    dataArray
      .sort((a, b) => {
        if (a[field] < b[field]) return -1;
        if (a[field] > b[field]) return 1;
        return 0;
      })
      .forEach(item => {
        let key = item[field].substring(0, 1).toUpperCase();
        data[key] = data[key] || [];
        data[key].push(item);
      });
    console.log("formatted", data);
    return data;
  }

  render() {
    let sectionList;
    let renderSectionHeader;
    let dataSource = this.state.dataSource.cloneWithRows(
      this.state.formattedData
    );
    sectionList = !this.props.hideSectionList ? (
      <SectionList
        style={this.props.sectionListStyle}
        onSectionSelect={this.scrollToSection}
        sections={Object.keys(this.state.formattedData)}
        data={this.state.formattedData}
        getSectionListTitle={this.props.getSectionListTitle}
        component={this.props.sectionListItem}
      />
    ) : null;

    renderSectionHeader = this.renderSectionHeader;
    dataSource = this.state.dataSource.cloneWithRowsAndSections(
      this.state.formattedData
    );

    const renderFooter = this.props.footer
      ? this.renderFooter
      : this.props.renderFooter;

    const renderHeader = this.props.header
      ? this.renderHeader
      : this.props.renderHeader;

    const props = {
      ...this.props,
      onScroll: this.onScroll,
      onScrollAnimationEnd: this.onScrollAnimationEnd,
      dataSource,
      renderFooter,
      renderHeader,
      renderRow: this.renderRow,
      renderSectionHeader
    };

    props.style = void 0;

    return (
      <View ref="view" style={[styles.container, this.props.style]}>
        <ListView ref="listview" {...props} />
        {sectionList}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  }
});

const stylesheetProp = PropTypes.oneOfType([
  PropTypes.number,
  PropTypes.object
]);

AlphabetListView.propTypes = {
  /**
   * The data to render in the listview
   */
  data: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,

  /**
   * If this exists the array will be sorted into an object of alphabetically keyed arrays
   */
  sortOn: PropTypes.string,

  /**
   * Whether to show the section listing or not
   */
  hideSectionList: PropTypes.bool,

  /**
   * Functions to provide a title for the section header and the section list
   * items. If not provided, the section ids will be used (the keys from the data object)
   */
  getSectionTitle: PropTypes.func,
  getSectionListTitle: PropTypes.func,

  /**
   * Callback which should be called when a cell has been selected
   */
  onCellSelect: PropTypes.func,

  /**
   * Callback which should be called when the user scrolls to a section
   */
  onScrollToSection: PropTypes.func,

  /**
   * The cell element to render for each row
   */
  cell: PropTypes.func.isRequired,

  /**
   * A custom element to render for each section list item
   */
  sectionListItem: PropTypes.func,

  /**
   * A custom element to render for each section header
   */
  sectionHeader: PropTypes.func,

  /**
   * A custom element to render as footer
   */
  footer: PropTypes.func,

  /**
   * A custom element to render as header
   */
  header: PropTypes.func,

  /**
   * The height of the header element to render. Is required if a
   * header element is used, so the positions can be calculated correctly
   */
  headerHeight: PropTypes.number,

  /**
   * A custom function to render as footer
   */
  renderHeader: PropTypes.func,

  /**
   * A custom function to render as header
   */
  renderFooter: PropTypes.func,

  /**
   * An object containing additional props, which will be passed
   * to each cell component
   */
  cellProps: PropTypes.object,

  /**
   * The height of the section header component
   */
  sectionHeaderHeight: PropTypes.number.isRequired,

  /**
   * The height of the cell component
   */
  cellHeight: PropTypes.number.isRequired,

  /**
   * Whether to determine the y postion to scroll to by calculating header and
   * cell heights or by using the UIManager to measure the position of the
   * destination element. This is an exterimental feature
   */
  useDynamicHeights: PropTypes.bool,

  /**
   * Whether to set the current y offset as state and pass it to each
   * cell during re-rendering
   */
  updateScrollState: PropTypes.bool,

  /**
   * Styles to pass to the container
   */
  style: stylesheetProp,

  /**
   * Styles to pass to the section list container
   */
  sectionListStyle: stylesheetProp
};
